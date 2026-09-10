package com.modulefederation.metrocache

import android.system.Os
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.*
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.net.SocketTimeoutException
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.TimeUnit

class MFECacheModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "MFECache"

  // --- Restart ---

  @ReactMethod
  fun restart() {
    val activity = currentActivity ?: return
    val app = activity.application as? ReactApplication ?: return

    activity.runOnUiThread {
      try {
        // New arch (bridgeless): ReactHost.reload()
        app.reactHost?.reload("MFECache restart") ?: throw UnsupportedOperationException()
      } catch (_: Exception) {
        // Old arch fallback: recreate the React context via ReactInstanceManager
        app.reactNativeHost.reactInstanceManager.recreateReactContextInBackground()
      }
    }
  }

  private val httpClient = OkHttpClient.Builder()
    .connectTimeout(60, TimeUnit.SECONDS)
    .readTimeout(60, TimeUnit.SECONDS)
    .build()

  // --- File System Operations ---

  @ReactMethod
  fun writeFile(path: String, content: String, encoding: String, promise: Promise) {
    Thread {
      val file = File(path)
      val tempFile = File("$path.${UUID.randomUUID()}.tmp")
      try {
        file.parentFile?.mkdirs()
        val bytes = if (encoding == "base64") {
          android.util.Base64.decode(content, android.util.Base64.DEFAULT)
        } else {
          content.toByteArray(Charsets.UTF_8)
        }
        FileOutputStream(tempFile).use { output ->
          output.write(bytes)
          output.fd.sync()
        }
        Os.rename(tempFile.absolutePath, file.absolutePath)
        promise.resolve(null)
      } catch (e: Exception) {
        tempFile.delete()
        promise.reject("WRITE_ERROR", e.message, e)
      }
    }.start()
  }

  @ReactMethod
  fun readFile(path: String, encoding: String, promise: Promise) {
    Thread {
      try {
        val file = File(path)
        if (!file.exists()) {
          promise.reject("READ_ERROR", "File not found: $path")
          return@Thread
        }
        if (encoding == "base64") {
          val bytes = file.readBytes()
          promise.resolve(android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP))
        } else {
          promise.resolve(file.readText(Charsets.UTF_8))
        }
      } catch (e: Exception) {
        promise.reject("READ_ERROR", e.message, e)
      }
    }.start()
  }

  @ReactMethod
  fun readVerifiedFile(path: String, expectedSha256: String, promise: Promise) {
    Thread {
      try {
        val file = File(path)
        if (!file.exists()) {
          promise.reject("READ_ERROR", "Cached bundle is unavailable")
          return@Thread
        }
        val bytes = file.readBytes()
        val sha256 = sha256Hex(bytes)
        if (sha256 != expectedSha256.lowercase()) {
          promise.reject("HASH_MISMATCH", "Cached bundle integrity check failed")
          return@Thread
        }
        val source = Charsets.UTF_8.newDecoder()
          .onMalformedInput(CodingErrorAction.REPORT)
          .onUnmappableCharacter(CodingErrorAction.REPORT)
          .decode(ByteBuffer.wrap(bytes))
          .toString()
        val result = Arguments.createMap().apply {
          putString("source", source)
          putString("sha256", sha256)
        }
        promise.resolve(result)
      } catch (e: Exception) {
        promise.reject("READ_ERROR", "Failed to read cached bundle", e)
      }
    }.start()
  }

  @ReactMethod
  fun deleteFile(path: String, promise: Promise) {
    Thread {
      try {
        val file = File(path)
        if (file.exists()) {
          if (!file.deleteRecursively() || file.exists()) {
            promise.reject("DELETE_ERROR", "Failed to remove cache path")
            return@Thread
          }
        }
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("DELETE_ERROR", e.message, e)
      }
    }.start()
  }

  @ReactMethod
  fun fileExists(path: String, promise: Promise) {
    promise.resolve(File(path).exists())
  }

  @ReactMethod
  fun getDocumentDirectory(promise: Promise) {
    promise.resolve(reactApplicationContext.filesDir.absolutePath)
  }

  @ReactMethod
  fun getCacheDirectory(promise: Promise) {
    promise.resolve(File(reactApplicationContext.noBackupFilesDir, "zephyr-native-cache").absolutePath)
  }

  @ReactMethod
  fun getFileSize(path: String, promise: Promise) {
    Thread {
      try {
        val file = File(path)
        if (!file.exists()) {
          promise.reject("FILE_SIZE_ERROR", "File not found: $path")
          return@Thread
        }
        promise.resolve(file.length().toDouble())
      } catch (e: Exception) {
        promise.reject("FILE_SIZE_ERROR", e.message, e)
      }
    }.start()
  }

  // --- SHA-256 ---

  private fun sha256Hex(bytes: ByteArray): String {
    val digest = MessageDigest.getInstance("SHA-256")
    val hash = digest.digest(bytes)
    return hash.joinToString("") { "%02x".format(it) }
  }

  @ReactMethod
  fun sha256File(filePath: String, promise: Promise) {
    Thread {
      try {
        val file = File(filePath)
        if (!file.exists()) {
          promise.reject("SHA256_ERROR", "File not found: $filePath")
          return@Thread
        }
        promise.resolve(sha256Hex(file.readBytes()))
      } catch (e: Exception) {
        promise.reject("SHA256_ERROR", e.message, e)
      }
    }.start()
  }

  @ReactMethod
  fun sha256String(content: String, promise: Promise) {
    promise.resolve(sha256Hex(content.toByteArray(Charsets.UTF_8)))
  }

  // --- Download with SHA-256 ---

  @ReactMethod
  fun downloadFile(url: String, destPath: String, promise: Promise) {
    Thread {
      val destFile = File(destPath)
      // Unique temp name per-call — avoids two concurrent downloads to the same
      // destPath clobbering each other's .tmp file.
      val tempFile = File("$destPath.${UUID.randomUUID()}.tmp")
      try {
        val request = Request.Builder().url(url).get().build()
        httpClient.newCall(request).execute().use { response ->

          if (!response.isSuccessful) {
            promise.reject("HTTP_ERROR", "HTTP ${response.code}")
            return@Thread
          }

          val body = response.body ?: run {
            promise.reject("DOWNLOAD_ERROR", "Empty response body")
            return@Thread
          }

          destFile.parentFile?.mkdirs()

          val digest = MessageDigest.getInstance("SHA-256")
          var bytesWritten = 0L

          body.byteStream().use { input ->
            FileOutputStream(tempFile).use { output ->
              val buffer = ByteArray(8192)
              var read: Int
              while (input.read(buffer).also { read = it } != -1) {
                output.write(buffer, 0, read)
                digest.update(buffer, 0, read)
                bytesWritten += read
              }
              output.fd.sync()
            }
          }

          if (destFile.exists()) {
            tempFile.delete()
            promise.reject("STORAGE_ERROR", "Staging destination already exists")
            return@Thread
          }
          try {
            Os.rename(tempFile.absolutePath, destFile.absolutePath)
          } catch (_: Exception) {
            tempFile.delete()
            promise.reject("STORAGE_ERROR", "Failed to save staged bundle")
            return@Thread
          }

          val sha256 = digest.digest().joinToString("") { "%02x".format(it) }

          val result = Arguments.createMap().apply {
            putString("sha256", sha256)
            putDouble("bytesWritten", bytesWritten.toDouble())
          }
          promise.resolve(result)
        }
      } catch (_: SocketTimeoutException) {
        tempFile.delete()
        promise.reject("DOWNLOAD_TIMEOUT", "Bundle download timed out")
      } catch (_: Exception) {
        tempFile.delete()
        promise.reject("NETWORK_ERROR", "Failed to download staged bundle")
      }
    }.start()
  }

}
