// deleteOrphanTerms.js
// Script to delete all terms that are not attached to any publication

const mongoose = require("mongoose");
const Term = require("./models/Term");
const Publication = require("./models/Publication");
require("dotenv").config();
async function deleteOrphanTerms() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");

    // Find all term IDs that are referenced in any publication
    const publications = await Publication.find().select("terms").lean();
    console.log(`Found ${publications.length} publications.`);
    const usedTermIds = new Set();
    publications.forEach((pub) => {
      if (Array.isArray(pub.terms)) {
        pub.terms.forEach((termId) => usedTermIds.add(termId.toString()));
      }
    });

    // Find all terms
    const allTerms = await Term.find({});
    const orphanTerms = allTerms.filter(
      (term) => !usedTermIds.has(term._id.toString()),
    );
    if (orphanTerms.length === 0) {
      console.log("No orphan terms found.");
    } else {
      const orphanIds = orphanTerms.map((term) => term._id);
      const result = await Term.deleteMany({ _id: { $in: orphanIds } });
      console.log(`Deleted ${result.deletedCount} orphan terms.`);
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

deleteOrphanTerms();
