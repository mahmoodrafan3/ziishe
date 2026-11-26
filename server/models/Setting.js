import mongoose from 'mongoose';

// One document holds the storefront switches the admin can flip: maintenance
// mode and the technical-issue page. `key` keeps the collection to a single
// row so two admin tabs saving at once still update the same record.
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: 'site' },
    maintenanceEnabled: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: '' },
    issueEnabled: { type: Boolean, default: false },
    issueMessage: { type: String, default: '' },
  },
  { timestamps: true }
);

// Upsert so the first read or write creates the row without a race between
// two callers both inserting `key: 'site'`.
settingSchema.statics.getSite = function () {
  return this.findOneAndUpdate(
    { key: 'site' },
    { $setOnInsert: { key: 'site' } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

const Setting = mongoose.model('Setting', settingSchema);
export default Setting;
