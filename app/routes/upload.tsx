import {type FormEvent, useState} from 'react'
import Navbar from "~/components/Navbar";
import FileUploader from "~/components/FileUploader";
import {usePuterStore} from "~/lib/puter";
import {useNavigate} from "react-router";
import {convertPdfToImage} from "~/lib/pdf2img";
import {generateUUID} from "~/lib/utils";
import {prepareInstructions} from "../../constants";

export const meta = () => ([
    { title: 'ResumeIQ | Upload ' },
    { name: 'description', content: 'Analysing Resume' },
])

const Upload = () => {
    const { auth, isLoading, fs, ai, kv } = usePuterStore();
    const navigate = useNavigate();
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [file, setFile] = useState<File | null>(null);

    const handleFileSelect = (file: File | null) => {
        setFile(file)
    }

    const handleAnalyze = async ({ companyName, jobTitle, jobDescription, file }: { companyName: string, jobTitle: string, jobDescription: string, file: File  }) => {
        setIsProcessing(true);

        try {
            setStatusText('Uploading resume...');
            const uploadedFile = await fs.upload([file]);
            if(!uploadedFile) {
                setStatusText('Error: Failed to upload file');
                setIsProcessing(false);
                return;
            }
            console.log('PDF uploaded successfully:', uploadedFile.path);

            setStatusText('Converting PDF to image... This may take a moment.');
            console.log('Starting PDF conversion...');
            
            const conversionResult = await convertPdfToImage(file);
            
            if (!conversionResult.file) {
                const errorMsg = conversionResult.error || 'PDF conversion failed';
                console.error('Conversion failed:', errorMsg);
                setStatusText(`Error: ${errorMsg}`);
                setIsProcessing(false);
                return;
            }

            console.log('PDF converted successfully, uploading image...');
            setStatusText('Uploading converted image...');
            
            const uploadedImage = await fs.upload([conversionResult.file]);
            if(!uploadedImage) {
                setStatusText('Error: Failed to upload converted image');
                setIsProcessing(false);
                return;
            }

            console.log('Image uploaded successfully:', uploadedImage.path);

            setStatusText('Preparing analysis data...');
            const uuid = generateUUID();
            const data = {
                id: uuid,
                resumePath: uploadedFile.path,
                imagePath: uploadedImage.path, // Now we have the image path
                companyName, 
                jobTitle, 
                jobDescription,
                feedback: '',
            }
            await kv.set(`resume:${uuid}`, JSON.stringify(data));

            setStatusText('Analyzing resume with AI...');
            console.log('Starting AI analysis...');

            const feedback = await ai.feedback(
                uploadedFile.path,
                prepareInstructions({ jobTitle, jobDescription })
            )
            
            if (!feedback) {
                setStatusText('Error: Failed to analyze resume');
                setIsProcessing(false);
                return;
            }

            console.log('AI analysis complete');
            const feedbackText = typeof feedback.message.content === 'string'
                ? feedback.message.content
                : feedback.message.content[0].text;

            try {
                data.feedback = JSON.parse(feedbackText);
            } catch (parseError) {
                console.log('Feedback not JSON, storing as text');
                data.feedback = feedbackText;
            }
            
            await kv.set(`resume:${uuid}`, JSON.stringify(data));
            setStatusText('Analysis complete! Redirecting...');
            console.log('Process complete, redirecting...');
            
            setTimeout(() => {
                navigate(`/resume/${uuid}`);
            }, 1000);

        } catch (error) {
            console.error('Analysis error:', error);
            setStatusText(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
            setIsProcessing(false);
        }
    }

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget.closest('form');
        if(!form) return;
        const formData = new FormData(form);

        const companyName = formData.get('company-name') as string;
        const jobTitle = formData.get('job-title') as string;
        const jobDescription = formData.get('job-description') as string;

        if(!file) {
            setStatusText('Please select a PDF file to upload');
            return;
        }

        if (file.type !== 'application/pdf') {
            setStatusText('Please upload a PDF file only');
            return;
        }

        // Check file size (max 5MB for better conversion performance)
        if (file.size > 5 * 1024 * 1024) {
            setStatusText('File size should be less than 5MB for optimal processing');
            return;
        }

        if (!companyName.trim() || !jobTitle.trim() || !jobDescription.trim()) {
            setStatusText('Please fill in all required fields');
            return;
        }

        setStatusText('');
        handleAnalyze({ companyName, jobTitle, jobDescription, file });
    }

    return (
        <main className="bg-[url('/images/bg-main.svg')] bg-cover">
            <Navbar />

            <section className="main-section">
                <div className="page-heading py-16">
                    <h1>Smart feedback for your dream job</h1>
                    {isProcessing ? (
                        <>
                            <h2>{statusText}</h2>
                            <img src="/images/resume-scan.gif" className="w-full max-w-lg mx-auto" />
                            <div className="mt-4 text-center">
                                <div className="inline-flex items-center px-4 py-2 bg-blue-50 rounded-lg">
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent mr-2"></div>
                                    <span className="text-sm text-blue-700">Processing your resume...</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <h2>Drop your resume for an ATS score and improvement tips</h2>
                    )}
                    {!isProcessing && (
                        <form id="upload-form" onSubmit={handleSubmit} className="flex flex-col gap-4 mt-8">
                            <div className="form-div">
                                <label htmlFor="company-name">Company Name *</label>
                                <input 
                                    type="text" 
                                    name="company-name" 
                                    placeholder="e.g., Google, Microsoft" 
                                    id="company-name" 
                                    required 
                                />
                            </div>
                            <div className="form-div">
                                <label htmlFor="job-title">Job Title *</label>
                                <input 
                                    type="text" 
                                    name="job-title" 
                                    placeholder="e.g., Software Engineer" 
                                    id="job-title" 
                                    required 
                                />
                            </div>
                            <div className="form-div">
                                <label htmlFor="job-description">Job Description *</label>
                                <textarea 
                                    rows={5} 
                                    name="job-description" 
                                    placeholder="Paste the complete job description here..." 
                                    id="job-description" 
                                    required 
                                />
                            </div>

                            <div className="form-div">
                                <FileUploader onFileSelect={handleFileSelect} />
                                {file && (
                                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                        <p className="text-sm text-green-700">
                                            ✓ Selected: <strong>{file.name}</strong>
                                        </p>
                                        <p className="text-xs text-green-600">
                                            Size: {(file.size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                    </div>
                                )}
                            </div>

                            {statusText && !isProcessing && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-red-600 text-sm">{statusText}</p>
                                </div>
                            )}

                            <button 
                                className="primary-button" 
                                type="submit"
                                disabled={!file || isProcessing}
                            >
                                {isProcessing ? 'Processing...' : 'Analyze Resume'}
                            </button>
                        </form>
                    )}
                </div>
            </section>
        </main>
    )
}

export default Upload