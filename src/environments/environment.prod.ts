// PROD environment. Used by `ng serve|build --configuration prod` (the default build).
// TODO: confirm apiUrl + encryptionKey with the Production backend before releasing.
export const environment = {
  production: true,
  name: 'prod',
  apiUrl: 'https://hopkinsconsultingapi.alliancetek.net/api/v1',
  encryptionKey: '81T7--8DgcxIXGudO29Za253BJ8asM3J58dsP9LGBZ4=',
  usaCountryId: 0,
  // Which portal this build represents. Drives the default active tab in the
  // login role switcher; the OTHER tab links out to the sibling portal below.
  portalRole: 'admin',
  // TODO: set the deployed Production login URLs for each admin portal.
  portalUrls: {
    superAdmin: '',
    organizationAdmin: '',
  },
  // TODO: set the Azure Blob Storage account name + SAS token (no leading '?').
  azureStorageAccount: '',
  azureStorageSasToken: '',
  // Azure Blob containers per claim document category.
  claimDocumentContainers: {
    treatmentPlan: 'xm54sjimyp',
    progressNotes: 'f8upyo4t3s',
    dla20: 'njo0wrdux4',
  },
  // Azure Blob container for profile image uploads.
  profileImageContainer: 'd3i4pdeyh0',
  // Azure Blob container for claim batch imports.
  claimBatchContainer: 'no0ibvdr2l',
  // Azure Blob container for bulk upload documents.
  bulkUploadContainer: 'gt7xpgvo3y',
};
