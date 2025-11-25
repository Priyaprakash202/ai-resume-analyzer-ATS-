export interface ConvertResult {
  file: File | null;
  error?: string;
}

// Declare global types for PDF.js
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

// Load PDF.js from CDN
const loadPdfJs = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.pdfjsLib) {
      resolve(window.pdfjsLib);
      return;
    }

    // Create script element
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    
    script.onload = () => {
      // Set worker source
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      } else {
        reject(new Error('PDF.js failed to load'));
      }
    };
    
    script.onerror = () => {
      reject(new Error('Failed to load PDF.js from CDN'));
    };
    
    document.head.appendChild(script);
  });
};

export const convertPdfToImage = async (file: File): Promise<ConvertResult> => {
  try {
    console.log('Starting PDF to image conversion...', file.name);
    
    // Validate file
    if (!file || file.type !== 'application/pdf') {
      return { file: null, error: 'Invalid PDF file' };
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return { file: null, error: 'PDF file too large (max 10MB)' };
    }

    // Load PDF.js
    console.log('Loading PDF.js library...');
    let pdfjsLib;
    try {
      pdfjsLib = await loadPdfJs();
    } catch (loadError) {
      console.error('Failed to load PDF.js:', loadError);
      return { file: null, error: 'Failed to load PDF processing library' };
    }

    // Convert file to array buffer
    console.log('Converting file to array buffer...');
    const arrayBuffer = await file.arrayBuffer();

    // Load PDF document
    console.log('Loading PDF document...');
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    
    const pdf = await loadingTask.promise;
    console.log(`PDF loaded successfully. Pages: ${pdf.numPages}`);

    // Get first page
    console.log('Getting first page...');
    const page = await pdf.getPage(1);

    // Calculate viewport with high quality
    const scale = 2.5; // Higher scale for better quality
    const viewport = page.getViewport({ scale });
    console.log(`Viewport: ${viewport.width}x${viewport.height}`);

    // Create canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      return { file: null, error: 'Canvas not supported in this browser' };
    }

    // Set canvas dimensions
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Fill with white background
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Configure render context
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
      background: 'white',
      intent: 'display',
    };

    // Render PDF page to canvas
    console.log('Rendering PDF page to canvas...');
    await page.render(renderContext).promise;
    console.log('Page rendered successfully');

    // Convert canvas to blob
    console.log('Converting canvas to image...');
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve({ file: null, error: 'Failed to create image from PDF' });
            return;
          }

          // Create file with proper naming
          const fileName = file.name.replace(/\.pdf$/i, '.png');
          const imageFile = new File([blob], fileName, {
            type: 'image/png',
            lastModified: Date.now()
          });

          console.log(`Conversion successful: ${imageFile.name} (${(imageFile.size / 1024).toFixed(1)}KB)`);
          resolve({ file: imageFile });
        },
        'image/png',
        0.92 // High quality but reasonable file size
      );
    });

  } catch (error) {
    console.error('PDF conversion error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'PDF conversion failed';
    if (error instanceof Error) {
      if (error.message.includes('Invalid PDF')) {
        errorMessage = 'Invalid or corrupted PDF file';
      } else if (error.message.includes('password')) {
        errorMessage = 'Password-protected PDFs are not supported';
      } else if (error.message.includes('network')) {
        errorMessage = 'Network error while loading PDF library';
      } else {
        errorMessage = `Conversion error: ${error.message}`;
      }
    }
    
    return { file: null, error: errorMessage };
  }
};