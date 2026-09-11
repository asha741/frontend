// STAGE environment. Used by `ng serve|build --configuration stage`.
// TODO: confirm apiUrl + encryptionKey with the Stage backend before releasing.
export const environment = {
  production: true,
  name: 'stage',
  apiUrl: 'https://hopkinsconsultingstageapi.alliancetek.net/api/v1',
  encryptionKey: '81T7--8DgcxIXGudO29Za253BJ8asM3J58dsP9LGBZ4=',
  usaCountryId: 0,
  // Which portal this build represents. Drives the default active tab in the
  // login role switcher; the OTHER tab links out to the sibling portal below.
  portalRole: 'admin',
  // Deployed Stage login URLs for each admin portal.
  portalUrls: {
    superAdmin: 'https://hopkinsconsultingstageadmin.alliancetek.net',
    organizationAdmin: 'https://hopkinsconsultingstageagency.alliancetek.net',
  },
  // TODO: set the Azure Blob Storage account name + SAS token (no leading '?').
  azureStorageAccount: 'hodk40dpmj38dnxnw',
  azureStorageSasToken: '?sv=2025-07-05&ss=btqf&srt=sco&spr=https&st=2026-07-14T08%3A09%3A20Z&se=2050-07-15T08%3A09%3A00Z&sp=rwdxftlacup&sig=FK%2BUwx6eTKkmn5PWtoMSBWmq1oIBFgNnAZvk41b%2FlYs%3D',
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
