// utils/detectDeviceType.ts

const isAndroid = (): boolean => {
  return /Android/i.test(navigator.userAgent);
};

const isIOS = (): boolean => {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
};

const isDesktop = (): boolean => {
  return !isAndroid() && !isIOS();
};

export { isAndroid, isIOS, isDesktop };
