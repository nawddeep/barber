/** A 10-digit Indian mobile number: starts with 6 to 9. */
export const INDIAN_MOBILE = /^[6-9]\d{9}$/;
export const isIndianMobile = (phone: string) => INDIAN_MOBILE.test(phone);
