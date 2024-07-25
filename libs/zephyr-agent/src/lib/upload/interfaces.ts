import { UploadOptions } from './upload';

export interface UploaderInterface {
  upload(options: UploadOptions): Promise<boolean>;
}
