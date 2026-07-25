const fs = require('fs');
const path = require('path');

const CLOUD_NAME = 'envkmzcu';
const UPLOAD_PRESET = 'ml_default';
const IMAGES_DIR = 'C:\\Users\\GAMER ZONE\\Desktop\\Joulane\\JOULANE_READY_FOR_UPLOAD\\images';
const PRODUCTS_FILE = path.join(__dirname, 'src', 'data', 'products.js');

async function uploadToCloudinary(filePath) {
    const fileName = path.basename(filePath);
    const fileBuffer = fs.readFileSync(filePath);
    const base64Str = 'data:image/png;base64,' + fileBuffer.toString('base64');
    
    const body = JSON.stringify({
        file: base64Str,
        upload_preset: UPLOAD_PRESET
    });

    try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: body
        });
        if (res.ok) {
            const data = await res.json();
            return data.secure_url;
        } else {
            console.error('Failed to upload', fileName, res.status, await res.text());
        }
    } catch(err) {
        console.error('Exception on', fileName, err);
    }
    return null;
}

async function main() {
    console.log("Reading images...");
    const files = fs.readdirSync(IMAGES_DIR).filter(f => f.toLowerCase().endsWith('.png'));
    
    let productsContent = fs.readFileSync(PRODUCTS_FILE, 'utf-8');
    
    console.log(`Found ${files.length} images. Starting upload...`);
    let uploaded = 0;
    
    for (const file of files) {
        const filePath = path.join(IMAGES_DIR, file);
        if (!productsContent.includes(`/images/${file}`)) {
            continue;
        }
        console.log(`Uploading ${file}...`);
        const url = await uploadToCloudinary(filePath);
        if (url) {
            console.log(`Uploaded! URL: ${url}`);
            productsContent = productsContent.split(`"/images/${file}"`).join(`"${url}"`);
            uploaded++;
        }
    }
    
    fs.writeFileSync(PRODUCTS_FILE, productsContent);
    console.log(`Done! Uploaded and replaced ${uploaded} images in products.js`);
}

main();
