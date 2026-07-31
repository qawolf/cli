/** Android SDK root. `ANDROID_HOME` wins over the older `ANDROID_SDK_ROOT`. */
export function androidSdkHome(): string | undefined {
  return process.env["ANDROID_HOME"] ?? process.env["ANDROID_SDK_ROOT"];
}
