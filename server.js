const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Replicate = require('replicate');

const app = express();
app.use(express.json());
app.use(express.static('.'));

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || ''
});

async function generateImage(prompt, options) {
  const width = options.width || 512;
  const height = options.height || 512;
  const steps = options.steps || 50;
  const guidanceScale = options.guidance_scale || 7.5;

  const output = await replicate.run(
    'stability-ai/stable-diffusion:db21e45d3f8f5f12345b364ab8795',
    {
      input: {
        prompt,
        width,
        height,
        num_inference_steps: steps,
        guidance_scale: guidanceScale
      }
    }
  );

  const imageUrl = Array.isArray(output) ? output[0] : output;
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.png`;
  const filePath = path.join(__dirname, 'generated', fileName);
  const response = await axios.get(imageUrl, { responseType: 'stream' });
  await new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(filePath);
    response.data.pipe(writeStream);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
  return '/generated/' + fileName;
}

app.post('/generate', async (req, res) => {
  const { prompt, width, height, steps, guidance_scale } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt required' });
  }
  try {
    const imagePath = await generateImage(prompt, { width, height, steps, guidance_scale });
    res.json({ image: imagePath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Generation failed' });
  }
});

const PORT = process.env.PORT || 3000;
if (!fs.existsSync(path.join(__dirname, 'generated'))) {
  fs.mkdirSync(path.join(__dirname, 'generated'));
}
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
