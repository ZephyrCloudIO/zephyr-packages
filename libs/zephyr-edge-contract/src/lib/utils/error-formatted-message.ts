// ! If anyone is adding new errors to this file please make sure the description and debugging for users are sync with documentation's error page
import { redBright } from './picocolor';
import { Errors, ErrorCategories } from './error-codes-messages';
export const docsPrefix = 'https://docs.zephyr-cloud.io/errors';

export function errCode<K extends keyof typeof Errors>(err: K) {
  const id = Errors[err].id as (typeof Errors)[K]['id'];
  const prefix = ErrorCategories[Errors[err].kind] as (typeof ErrorCategories)[(typeof Errors)[K]['kind']];

  // we have less categories and more errors, so make sense to be ZEPPIII
  // where ZE is a constant, PP is the category, and I is the error id

  const paddedId = id.toString().padStart(3, '0');
  const paddedPrefix = prefix.toString().padStart(2, '0');

  return `ZE${paddedPrefix}${paddedId}` as const;
}

export function errMsg<K extends keyof typeof Errors>(err: K) {
  return Errors[err].message;
}

export function err<K extends keyof typeof Errors>(err: K) {
  const id = Errors[err].id as (typeof Errors)[K]['id'];
  const prefix = ErrorCategories[Errors[err].kind] as (typeof ErrorCategories)[(typeof Errors)[K]['kind']];

  // we have less categories and more errors, so make sense to be ZEPPIII
  // where ZE is a constant, PP is the category, and I is the error id
  const paddedId = id.toString().padStart(3, '0');
  const paddedPrefix = prefix.toString().padStart(2, '0');

  const errorCode = `ZE${paddedPrefix}${paddedId}` as const;
  const errorMsg = Errors[err].message;
  const errorDoc = `See potential workaround and how to debug this error in our documentation ${docsPrefix}/${errorCode.toLowerCase()}`;

  const fullMsg = redBright(`Error code: ${errorCode}. ${errorMsg} \n ${errorDoc}`);

  return fullMsg;
}
