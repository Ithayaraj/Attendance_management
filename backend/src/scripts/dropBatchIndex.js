import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const dropBatchIndexes = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('batches');

    // Get all indexes
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes);

    // Drop all indexes except _id
    for (const index of indexes) {
      if (index.name !== '_id_') {
        console.log(`Dropping index: ${index.name}`);
        await collection.dropIndex(index.name);
        console.log(`✓ Dropped index: ${index.name}`);
      }
    }

    console.log('✓ All custom indexes dropped successfully!');
    console.log('You can now restart your server.');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

dropBatchIndexes();
