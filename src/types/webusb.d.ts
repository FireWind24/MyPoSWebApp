interface USBDevice {
  open(): Promise<void>
  close(): Promise<void>
  selectConfiguration(n: number): Promise<void>
  claimInterface(n: number): Promise<void>
  transferOut(endpoint: number, data: ArrayBuffer): Promise<USBOutTransferResult>
}

interface Navigator {
  usb?: {
    requestDevice(options: { filters: Array<{ vendorId?: number; productId?: number }> }): Promise<USBDevice>
    getDevices(): Promise<USBDevice[]>
  }
}
