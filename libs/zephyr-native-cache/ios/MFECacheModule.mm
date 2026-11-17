#import "MFECacheModule.h"
#import <React/RCTReloadCommand.h>
#import <React/RCTUtils.h>
#import <CommonCrypto/CommonDigest.h>

@implementation MFECacheModule

RCT_EXPORT_MODULE(MFECache)

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

#pragma mark - Restart

RCT_EXPORT_METHOD(restart)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    RCTTriggerReloadCommandListeners(@"MFECache restart");
  });
}

#pragma mark - File System Operations

RCT_EXPORT_METHOD(writeFile:(NSString *)path
                  content:(NSString *)content
                  encoding:(NSString *)encoding
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    @try {
      NSData *data;
      if ([encoding isEqualToString:@"base64"]) {
        data = [[NSData alloc] initWithBase64EncodedString:content options:0];
      } else {
        data = [content dataUsingEncoding:NSUTF8StringEncoding];
      }

      if (!data) {
        reject(@"WRITE_ERROR", @"Invalid file content", nil);
        return;
      }

      NSString *dir = [path stringByDeletingLastPathComponent];
      NSFileManager *fm = [NSFileManager defaultManager];
      if (![fm fileExistsAtPath:dir]) {
        NSError *directoryError = nil;
        if (![fm createDirectoryAtPath:dir withIntermediateDirectories:YES attributes:nil error:&directoryError]) {
          reject(@"WRITE_ERROR", @"Failed to create cache directory", directoryError);
          return;
        }
      }

      NSError *writeError = nil;
      if (![data writeToFile:path options:NSDataWritingAtomic error:&writeError]) {
        reject(@"WRITE_ERROR", @"Failed to atomically write cache state", writeError);
        return;
      }
      resolve(nil);
    } @catch (NSException *exception) {
      reject(@"WRITE_ERROR", exception.reason, nil);
    }
  });
}

RCT_EXPORT_METHOD(readFile:(NSString *)path
                  encoding:(NSString *)encoding
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSData *data = [NSData dataWithContentsOfFile:path];
    if (!data) {
      reject(@"READ_ERROR", [NSString stringWithFormat:@"File not found: %@", path], nil);
      return;
    }
    if ([encoding isEqualToString:@"base64"]) {
      resolve([data base64EncodedStringWithOptions:0]);
    } else {
      resolve([[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding]);
    }
  });
}

RCT_EXPORT_METHOD(readVerifiedFile:(NSString *)path
                  expectedSha256:(NSString *)expectedSha256
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSData *data = [NSData dataWithContentsOfFile:path];
    if (!data) {
      reject(@"READ_ERROR", @"Cached bundle is unavailable", nil);
      return;
    }

    NSString *sha256 = [self sha256FromData:data];
    if (![sha256 isEqualToString:[expectedSha256 lowercaseString]]) {
      reject(@"HASH_MISMATCH", @"Cached bundle integrity check failed", nil);
      return;
    }

    NSString *source = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    if (!source) {
      reject(@"READ_ERROR", @"Cached bundle is not valid UTF-8", nil);
      return;
    }
    resolve(@{ @"source": source, @"sha256": sha256 });
  });
}

RCT_EXPORT_METHOD(deleteFile:(NSString *)path
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSError *error;
    [[NSFileManager defaultManager] removeItemAtPath:path error:&error];
    if (error) {
      reject(@"DELETE_ERROR", error.localizedDescription, error);
    } else {
      resolve(nil);
    }
  });
}

RCT_EXPORT_METHOD(fileExists:(NSString *)path
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  BOOL exists = [[NSFileManager defaultManager] fileExistsAtPath:path];
  resolve(@(exists));
}

RCT_EXPORT_METHOD(getDocumentDirectory:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
  resolve(paths.firstObject);
}

RCT_EXPORT_METHOD(getCacheDirectory:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  NSError *error = nil;
  NSURL *applicationSupport = [[NSFileManager defaultManager]
    URLForDirectory:NSApplicationSupportDirectory
    inDomain:NSUserDomainMask
    appropriateForURL:nil
    create:YES
    error:&error];
  if (!applicationSupport) {
    reject(@"CACHE_DIRECTORY_ERROR", @"Application Support is unavailable", error);
    return;
  }

  NSURL *cacheRoot = [applicationSupport URLByAppendingPathComponent:@"ZephyrNativeCache" isDirectory:YES];
  NSFileManager *fm = [NSFileManager defaultManager];
  if (![fm createDirectoryAtURL:cacheRoot withIntermediateDirectories:YES attributes:nil error:&error]) {
    reject(@"CACHE_DIRECTORY_ERROR", @"Failed to create cache directory", error);
    return;
  }

  if (![cacheRoot setResourceValue:@YES forKey:NSURLIsExcludedFromBackupKey error:&error]) {
    reject(@"CACHE_DIRECTORY_ERROR", @"Failed to exclude cache from backup", error);
    return;
  }
  resolve(cacheRoot.path);
}

RCT_EXPORT_METHOD(getFileSize:(NSString *)path
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSFileManager *fm = [NSFileManager defaultManager];
    NSError *error;
    NSDictionary *attrs = [fm attributesOfItemAtPath:path error:&error];
    if (error) {
      reject(@"FILE_SIZE_ERROR", error.localizedDescription, error);
    } else {
      NSNumber *size = attrs[NSFileSize];
      resolve(size ?: @(0));
    }
  });
}

#pragma mark - SHA-256

- (NSString *)sha256FromData:(NSData *)data {
  unsigned char hash[CC_SHA256_DIGEST_LENGTH];
  CC_SHA256(data.bytes, (CC_LONG)data.length, hash);
  NSMutableString *hex = [NSMutableString stringWithCapacity:CC_SHA256_DIGEST_LENGTH * 2];
  for (int i = 0; i < CC_SHA256_DIGEST_LENGTH; i++) {
    [hex appendFormat:@"%02x", hash[i]];
  }
  return hex;
}

RCT_EXPORT_METHOD(sha256File:(NSString *)filePath
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSData *data = [NSData dataWithContentsOfFile:filePath];
    if (!data) {
      reject(@"SHA256_ERROR", [NSString stringWithFormat:@"File not found: %@", filePath], nil);
      return;
    }
    resolve([self sha256FromData:data]);
  });
}

RCT_EXPORT_METHOD(sha256String:(NSString *)content
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  NSData *data = [content dataUsingEncoding:NSUTF8StringEncoding];
  resolve([self sha256FromData:data]);
}

#pragma mark - Download with streaming SHA-256

RCT_EXPORT_METHOD(downloadFile:(NSString *)urlString
                  destPath:(NSString *)destPath
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  NSURL *url = [NSURL URLWithString:urlString];
  if (!url) {
    reject(@"DOWNLOAD_ERROR", @"Invalid URL", nil);
    return;
  }

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  [request setHTTPMethod:@"GET"];
  [request setTimeoutInterval:60];

  NSURLSessionDownloadTask *task = [[NSURLSession sharedSession]
    downloadTaskWithRequest:request
    completionHandler:^(NSURL *tempFileURL, NSURLResponse *response, NSError *error) {
      if (error) {
        NSString *code = error.code == NSURLErrorTimedOut ? @"DOWNLOAD_TIMEOUT" : @"NETWORK_ERROR";
        reject(code, @"Failed to download staged bundle", nil);
        return;
      }

      NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
      if (httpResponse.statusCode != 200) {
        reject(@"HTTP_ERROR",
               [NSString stringWithFormat:@"HTTP %ld", (long)httpResponse.statusCode],
               nil);
        return;
      }

      if (!tempFileURL) {
        reject(@"DOWNLOAD_ERROR", @"No temporary file from download", nil);
        return;
      }

      // Streaming SHA-256: read temp file in chunks, never load entire body into memory
      CC_SHA256_CTX ctx;
      CC_SHA256_Init(&ctx);

      NSInputStream *stream = [NSInputStream inputStreamWithURL:tempFileURL];
      [stream open];
      uint8_t buffer[8192];
      NSInteger bytesRead;
      NSUInteger totalBytes = 0;
      while ((bytesRead = [stream read:buffer maxLength:sizeof(buffer)]) > 0) {
        CC_SHA256_Update(&ctx, buffer, (CC_LONG)bytesRead);
        totalBytes += (NSUInteger)bytesRead;
      }
      [stream close];
      if (bytesRead < 0) {
        reject(@"DOWNLOAD_ERROR", @"Failed to read downloaded bundle", nil);
        return;
      }

      unsigned char hash[CC_SHA256_DIGEST_LENGTH];
      CC_SHA256_Final(hash, &ctx);

      NSMutableString *hex = [NSMutableString stringWithCapacity:CC_SHA256_DIGEST_LENGTH * 2];
      for (int i = 0; i < CC_SHA256_DIGEST_LENGTH; i++) {
        [hex appendFormat:@"%02x", hash[i]];
      }

      // Ensure destination directory exists
      NSString *dir = [destPath stringByDeletingLastPathComponent];
      NSFileManager *fm = [NSFileManager defaultManager];
      NSError *directoryError = nil;
      if (![fm createDirectoryAtPath:dir withIntermediateDirectories:YES attributes:nil error:&directoryError]) {
        reject(@"STORAGE_ERROR", @"Failed to create staging directory", directoryError);
        return;
      }

      if ([fm fileExistsAtPath:destPath]) {
        reject(@"STORAGE_ERROR", @"Staging destination already exists", nil);
        return;
      }

      NSError *moveError = nil;
      BOOL moved = [fm moveItemAtURL:tempFileURL
                               toURL:[NSURL fileURLWithPath:destPath]
                               error:&moveError];
      if (!moved) {
        reject(@"STORAGE_ERROR", @"Failed to save staged bundle", moveError);
        return;
      }

      resolve(@{
        @"sha256": hex,
        @"bytesWritten": @(totalBytes)
      });
    }];

  [task resume];
}

@end
