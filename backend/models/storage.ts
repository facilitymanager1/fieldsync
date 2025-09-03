// Data Storage & Encryption data model (example for encrypted blob)
export interface EncryptedBlob {
  id: string;
  userId: string;
  data: string; // base64 or encrypted string
  keyId: string;
  createdAt: Date;
}
