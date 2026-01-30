import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { CLIPVisionModelWithProjection, AutoProcessor, RawImage, env } from '@xenova/transformers';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const config = {
  port: process.env.PORT || 3000,
  corsOrigins: process.env.CORS_ORIGINS || '*',
  dogImagesDir: process.env.DOG_IMAGES_DIR || path.join(__dirname, 'dog-images'),
  uploadsDir: process.env.UPLOADS_DIR || path.join(__dirname, 'uploads'),
  modelName: 'Xenova/clip-vit-base-patch32'
};

// Transformers.js config
env.allowLocalModels = false;

const app = express();

// Ensure uploads directory exists
await fs.mkdir(config.uploadsDir, { recursive: true });

const upload = multer({ dest: config.uploadsDir });

// CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (config.corsOrigins === '*') {
    res.header('Access-Control-Allow-Origin', '*');
  } else {
    const allowedOrigins = config.corsOrigins.split(',').map(o => o.trim());
    if (allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// Serve dog images statically
app.use('/dog-images', express.static(config.dogImagesDir));

// Model and index state
let model = null;
let processor = null;
const dogIndex = [];

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Extract dog name from filename like "page1_10_photo_of_blondie.jpg"
 */
function extractDogName(filename) {
  const nameWithoutExt = path.parse(filename).name;
  const match = nameWithoutExt.match(/photo_of_(.+)/);

  if (match) {
    let dogName = match[1].replace(/_+$/, '').replace(/_/g, ' ');
    return dogName.charAt(0).toUpperCase() + dogName.slice(1);
  }

  return nameWithoutExt;
}

/**
 * Generate dummy pet data for results display
 */
function generateDummyPetData(name) {
  const breeds = [
    'English Bulldog', 'Golden Retriever', 'Labrador', 'Beagle', 'Poodle',
    'German Shepherd', 'French Bulldog', 'Boxer', 'Dachshund', 'Corgi',
    'Husky', 'Border Collie', 'Australian Shepherd', 'Shiba Inu', 'Pug'
  ];

  const locations = [
    'West Hollywood, CA', 'Santa Monica, CA', 'Los Angeles, CA',
    'San Francisco, CA', 'San Diego, CA', 'Portland, OR', 'Seattle, WA',
    'Denver, CO', 'Austin, TX', 'New York, NY', 'Chicago, IL', 'Miami, FL'
  ];

  const descriptions = [
    `${name} is a lovable companion with a heart as big as their personality! They love belly rubs and long walks.`,
    `Meet ${name}, a playful pup who brings joy to everyone they meet. Great with kids and other pets!`,
    `${name} is looking for their forever home. They're gentle, loyal, and ready to be your best friend.`,
    `This adorable ${name} has a wonderful temperament and loves cuddles. Perfect for any loving family!`,
    `${name} is a bundle of energy and affection. They'll keep you active and make every day brighter.`
  ];

  const age = Math.floor(Math.random() * 10) + 1;
  const sex = Math.random() > 0.5 ? 'Male' : 'Female';

  return {
    breed: breeds[Math.floor(Math.random() * breeds.length)],
    age: age,
    ageText: age === 1 ? '1 Year' : `${age} Years`,
    sex: sex,
    location: locations[Math.floor(Math.random() * locations.length)],
    description: descriptions[Math.floor(Math.random() * descriptions.length)],
    matchScores: {
      appearance: Math.floor(Math.random() * 30) + 70,
      expression: Math.floor(Math.random() * 30) + 70,
      character: Math.floor(Math.random() * 30) + 70
    }
  };
}

/**
 * Generate CLIP embedding for an image
 */
async function embedImage(filePath) {
  const buf = await fs.readFile(filePath);

  const { data, info } = await sharp(buf)
    .resize(224, 224, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rawImage = new RawImage(
    new Uint8ClampedArray(data),
    info.width,
    info.height,
    info.channels
  );

  const inputs = await processor(rawImage);
  const output = await model(inputs);

  return output.image_embeds.data;
}

/**
 * Initialize model and build dog embeddings index
 */
async function bootstrap() {
  console.log('Starting server initialization...');
  console.log(`Dog images directory: ${config.dogImagesDir}`);

  // Load CLIP model
  console.time('Model loaded');
  model = await CLIPVisionModelWithProjection.from_pretrained(config.modelName);
  processor = await AutoProcessor.from_pretrained(config.modelName);
  console.timeEnd('Model loaded');

  // Build dog embeddings index
  console.time('Dog index built');

  try {
    const files = await fs.readdir(config.dogImagesDir);
    const imageFiles = files.filter(f =>
      !f.startsWith('.') && /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(f)
    );

    console.log(`Found ${imageFiles.length} dog images to index`);

    for (const file of imageFiles) {
      const fullPath = path.join(config.dogImagesDir, file);

      try {
        const embedding = await embedImage(fullPath);
        dogIndex.push({
          id: file,
          name: extractDogName(file),
          embedding
        });
        process.stdout.write('.');
      } catch (err) {
        console.warn(`\nSkipping ${file}: ${err.message}`);
      }
    }

    console.log('');
  } catch (err) {
    console.error(`Error reading dog images directory: ${err.message}`);
    console.log(`Make sure ${config.dogImagesDir} exists and contains image files`);
  }

  console.timeEnd('Dog index built');
  console.log(`Indexed ${dogIndex.length} dog photos`);
}

// Routes

/**
 * POST /api/match - Upload a photo to find matching dogs
 */
app.post('/api/match', upload.single('photo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }

  try {
    const userEmbed = await embedImage(req.file.path);

    const ranked = dogIndex
      .map(dog => {
        const dummyData = generateDummyPetData(dog.name);
        return {
          id: dog.id,
          name: dog.name,
          score: cosineSimilarity(userEmbed, dog.embedding),
          ...dummyData
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // Clean up uploaded file
    await fs.rm(req.file.path);

    if (ranked.length > 0) {
      console.log(`Match: ${ranked[0].name} (score: ${ranked[0].score.toFixed(4)})`);
    }

    res.json({ matches: ranked });
  } catch (err) {
    console.error('Match error:', err);

    // Clean up on error
    try {
      await fs.rm(req.file.path);
    } catch {}

    res.status(500).json({ error: 'Failed to compute match' });
  }
});

/**
 * GET /health - Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    indexed: dogIndex.length,
    model: config.modelName
  });
});

/**
 * GET / - Basic info
 */
app.get('/', (req, res) => {
  res.json({
    name: 'Pet-a-Likey API',
    version: '1.0.0',
    endpoints: {
      'POST /api/match': 'Upload a photo to find matching dogs',
      'GET /dog-images/:id': 'Get a dog image by ID',
      'GET /health': 'Health check'
    }
  });
});

// Start server
bootstrap()
  .then(() => {
    app.listen(config.port, '0.0.0.0', () => {
      console.log(`Pet-a-Likey API running on port ${config.port}`);
    });
  })
  .catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
