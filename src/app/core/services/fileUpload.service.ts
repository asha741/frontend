import { Injectable } from '@angular/core';
import { BlobServiceClient } from '@azure/storage-blob';

import { ConfigService } from '../config/config.service';
import { LoaderService } from './loader.service';
import { ToastService } from './toast.service';

/**
 * Uploads / deletes files directly to Azure Blob Storage using a SAS token.
 *
 * The storage account name and SAS token come from the build-time environment
 * via {@link ConfigService} (`azureStorageAccount` / `azureStorageSasToken`).
 * Uploaded files are renamed `<baseName>_<timestamp>.<ext>` and the generated
 * blob name is returned so the caller can persist it.
 */
@Injectable({ providedIn: 'root' })
export class FileUploadService {
  private readonly storageAccount: string;
  private readonly sasToken: string;
  private readonly blobSasUrl: string;

  constructor(
    private config: ConfigService,
    private loader: LoaderService,
    public toast: ToastService,
  ) {
    this.storageAccount = this.config.azureStorageAccount;
    // Tolerate a SAS token pasted with or without its leading '?'.
    this.sasToken = this.config.azureStorageSasToken.replace(/^\?/, '');
    this.blobSasUrl = `https://${this.storageAccount}.blob.core.windows.net/?${this.sasToken}`;
  }

  /**
   * Uploads `file` to `containerName` and returns the generated blob name,
   * or '' on any validation error / upload failure.
   */
  async uploadFile(file: File, containerName: string): Promise<string> {
    if (!file) {
      this.toast.error('No file selected for upload.');
      return '';
    }
    if (!containerName) {
      this.toast.error('Container name is required.');
      return '';
    }
    if (!this.isConfigured()) {
      this.toast.error('File storage is not configured.');
      return '';
    }

    this.loader.show();
    try {
      // Add a timestamp so uploads never collide; cap the base name length.
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop();
      // Keep only alphanumeric characters in the base name; replace anything
      // else (spaces, punctuation, unicode, etc.) with an underscore.
      const baseName = (file.name.substring(0, file.name.lastIndexOf('.')) || file.name)
        .replace(/[^a-zA-Z0-9]/g, '_')
        .slice(0, 25);
      const newFileName = `${baseName}_${timestamp}.${fileExtension}`;

      const blobServiceClient = new BlobServiceClient(this.blobSasUrl);
      const containerClient = blobServiceClient.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(newFileName);
      await blockBlobClient.uploadData(file, {
        blobHTTPHeaders: { blobContentType: file.type },
      });
      return newFileName;
    } catch {
      this.toast.error('Error uploading file.');
      return '';
    } finally {
      this.loader.hide();
    }
  }

  /** Deletes `blobName` from `containerName`. */
  async deleteFile(blobName: string, containerName: string): Promise<void> {
    if (!blobName || !containerName) {
      this.toast.error('Blob name and container name are required.');
      return;
    }
    if (!this.isConfigured()) {
      this.toast.error('File storage is not configured.');
      return;
    }

    this.loader.show();
    try {
      const blobServiceClient = new BlobServiceClient(this.blobSasUrl);
      const containerClient = blobServiceClient.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.delete();
    } catch {
      // this.toast.error('Error deleting file.');
    } finally {
      this.loader.hide();
    }
  }

  /** True only when both the storage account and SAS token are set. */
  private isConfigured(): boolean {
    return !!this.storageAccount && !!this.sasToken;
  }
}
