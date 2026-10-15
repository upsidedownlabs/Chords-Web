// File System Access API (not in lib.dom yet); used by the RP2040 UF2 flasher.
interface Window {
  showDirectoryPicker(options?: {
    id?: string;
    mode?: "read" | "readwrite";
    startIn?: string;
  }): Promise<FileSystemDirectoryHandle>;
}
