# Dog Look-a-Like Matcher

A Node.js application that uses CLIP (Contrastive Language-Image Pre-training) vision models to find which dog you look most like. Upload a photo and get matched with your canine doppelgänger!

## Features

- Uses open-weights CLIP vision model for image embedding
- In-memory vector similarity search
- Cosine similarity matching algorithm
- Returns top 5 dog matches with similarity scores
- Simple REST API interface
- Zero external dependencies for ML inference (runs completely in-process)

## Prerequisites

- Node.js 18+ (for native fetch support)
- npm or yarn
- At least 1GB of free disk space for model download

## Installation

1. Clone this repository:
```bash
git clone <your-repo-url>
cd dog-look-alike-matcher
```

2. Install dependencies:
```bash
npm install
```

3. Create the dogs directory and add dog images:
```bash
mkdir dogs
```

4. Populate the `dogs` folder with dog images:
   - Add JPG, PNG, GIF, BMP, or WebP images
   - File names (without extension) will be used as dog names
   - Example: `golden_retriever.jpg` will show as "golden_retriever"
   - More images = better variety of matches

## Usage

1. Start the server:
```bash
node server.js
```
Or set a custom port:
```bash
PORT=8080 node server.js
```

2. On first run, the server will:
   - Download the CLIP model (~400MB, one-time download)
   - Build embeddings for all images in the `./dogs` folder
   - Start listening on the specified port

3. The server is ready when you see:
```
Model loaded: X.XXXs
Dog index built: X.XXXs
Indexed XX dog photos
🐶  Server listening on http://localhost:3000
```

## API Endpoints

### POST /api/match
Upload a photo to find dog matches.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Field: `photo` (image file)

**Response:**
```json
{
  "matches": [
    {
      "id": "golden_retriever.jpg",
      "name": "golden_retriever",
      "score": 0.8523
    },
    // ... up to 5 matches, sorted by score
  ]
}
```

### GET /health
Check server status and indexed dogs count.

**Response:**
```json
{
  "status": "ok",
  "indexed": 25,
  "model": "Xenova/clip-vit-base-patch32"
}
```

## How It Works

1. **Model Loading**: Uses `@xenova/transformers` to load the CLIP ViT-B/32 model
2. **Image Processing**: 
   - Resizes images to 224x224 (CLIP's expected input)
   - Converts to RGB format
   - Generates 512-dimensional embedding vectors
3. **Similarity Matching**: 
   - Computes cosine similarity between user photo and all dog embeddings
   - Returns top 5 matches sorted by similarity score

## Project Structure

```
.
├── server.js           # Main application server
├── package.json        # Node.js dependencies
├── index.html         # Frontend interface (optional)
├── dogs/              # Dog images directory (not in repo)
│   ├── beagle.jpg
│   ├── poodle.png
│   └── ...
└── uploads/           # Temporary upload directory (auto-created)
```

## Dependencies

- **express**: Web framework
- **multer**: Multipart form data handling for file uploads
- **sharp**: High-performance image processing
- **@xenova/transformers**: Run transformer models in Node.js
- **node-fetch**: Fetch API support (for model downloading)

## Notes

- First startup takes longer due to model download
- All processing happens in-memory (no database required)
- Supports common image formats: JPG, PNG, GIF, BMP, WebP
- Hidden files (starting with `.`) in the dogs folder are ignored
- The `./dogs` folder must be created and populated before starting

## Serving the Frontend

To serve the included HTML frontend, add these lines to server.js:
```javascript
app.use(express.static('.'));
app.use('/dogs', express.static('dogs'));
```

Then access the application at `http://localhost:3000`

## Troubleshooting

- **"Error reading dogs directory"**: Create the `./dogs` folder and add images
- **Out of memory errors**: Reduce the number of dog images or increase Node.js memory limit
- **Slow first startup**: Model download is ~400MB, this is normal for first run

## License

ISC