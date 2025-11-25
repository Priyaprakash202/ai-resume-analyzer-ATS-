import {Link, useNavigate, useParams} from "react-router";
import {useEffect, useState} from "react";
import {usePuterStore} from "~/lib/puter";
import Summary from "~/components/Summary";
import ATS from "~/components/ATS";
import Details from "~/components/Details";

export const meta = () => ([
    { title: 'ResumeIQ | Review ' },
    { name: 'description', content: 'Detailed overview of your resume' },
])

const Resume = () => {
    const { auth, isLoading, fs, kv } = usePuterStore();
    const { id } = useParams();
    const [imageUrl, setImageUrl] = useState('');
    const [resumeUrl, setResumeUrl] = useState('');
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        if(!isLoading && !auth.isAuthenticated) {
            navigate(`/auth?next=/resume/${id}`);
        }
    }, [isLoading, auth.isAuthenticated, navigate, id]);

    useEffect(() => {
        const loadResume = async () => {
            try {
                setLoading(true);
                setError('');
                
                console.log('Loading resume data for ID:', id);
                const resume = await kv.get(`resume:${id}`);
                
                if(!resume) {
                    setError('Resume not found. Please try uploading again.');
                    setLoading(false);
                    return;
                }

                console.log('Raw resume data:', resume);
                const data = JSON.parse(resume);
                console.log('Parsed resume data:', data);

                // Load the PDF file
                if (data.resumePath) {
                    try {
                        const resumeBlob = await fs.read(data.resumePath);
                        if(resumeBlob) {
                            const pdfBlob = new Blob([resumeBlob], { type: 'application/pdf' });
                            const resumeUrl = URL.createObjectURL(pdfBlob);
                            setResumeUrl(resumeUrl);
                            console.log('Resume PDF loaded successfully');
                        }
                    } catch (fileError) {
                        console.error('Error loading resume file:', fileError);
                    }
                }

                // Load the image file
                if (data.imagePath) {
                    try {
                        console.log('Loading image from:', data.imagePath);
                        const imageBlob = await fs.read(data.imagePath);
                        if(imageBlob) {
                            const imageUrl = URL.createObjectURL(imageBlob);
                            setImageUrl(imageUrl);
                            console.log('Resume image loaded successfully');
                        } else {
                            console.log('No image blob returned');
                        }
                    } catch (imageError) {
                        console.error('Error loading image file:', imageError);
                    }
                } else {
                    console.log('No image path found in data');
                }

                // Set feedback data
                if (data.feedback) {
                    console.log('Feedback data found:', data.feedback);
                    setFeedback(data.feedback);
                } else {
                    console.log('No feedback data found');
                    setError('Analysis results not found. The analysis might still be processing.');
                }

                setLoading(false);
            } catch (error) {
                console.error('Error loading resume:', error);
                setError('Failed to load resume data. Please try again.');
                setLoading(false);
            }
        }

        if (id && !isLoading) {
            loadResume();
        }
    }, [id, isLoading, kv, fs]);

    // Cleanup URLs when component unmounts
    useEffect(() => {
        return () => {
            if (resumeUrl) URL.revokeObjectURL(resumeUrl);
            if (imageUrl) URL.revokeObjectURL(imageUrl);
        };
    }, [resumeUrl, imageUrl]);

    if (loading) {
        return (
            <main className="!pt-0">
                <nav className="resume-nav">
                    <Link to="/" className="back-button">
                        <img src="/icons/back.svg" alt="logo" className="w-2.5 h-2.5" />
                        <span className="text-gray-800 text-sm font-semibold">Back to Homepage</span>
                    </Link>
                </nav>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center">
                        <img src="/images/resume-scan-2.gif" className="w-64 mx-auto mb-4" />
                        <p className="text-lg text-gray-600">Loading your resume analysis...</p>
                    </div>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="!pt-0">
                <nav className="resume-nav">
                    <Link to="/" className="back-button">
                        <img src="/icons/back.svg" alt="logo" className="w-2.5 h-2.5" />
                        <span className="text-gray-800 text-sm font-semibold">Back to Homepage</span>
                    </Link>
                </nav>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center max-w-md">
                        <div className="text-red-500 text-6xl mb-4">⚠️</div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">Oops! Something went wrong</h2>
                        <p className="text-gray-600 mb-6">{error}</p>
                        <Link to="/" className="primary-button inline-block">
                            Try Again
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="!pt-0">
            <nav className="resume-nav">
                <Link to="/" className="back-button">
                    <img src="/icons/back.svg" alt="logo" className="w-2.5 h-2.5" />
                    <span className="text-gray-800 text-sm font-semibold">Back to Homepage</span>
                </Link>
            </nav>
            <div className="flex flex-row w-full max-lg:flex-col-reverse">
                <section className="feedback-section bg-[url('/images/bg-small.svg')] bg-cover h-[100vh] sticky top-0 items-center justify-center">
                    {imageUrl ? (
                        <div className="animate-in fade-in duration-1000 gradient-border max-sm:m-0 h-[90%] max-wxl:h-fit w-fit">
                            {resumeUrl ? (
                                <a href={resumeUrl} target="_blank" rel="noopener noreferrer" title="Click to view full PDF">
                                    <img
                                        src={imageUrl}
                                        className="w-full h-full object-contain rounded-2xl cursor-pointer hover:opacity-90 transition-opacity"
                                        alt="Resume preview"
                                        style={{ maxWidth: '400px', maxHeight: '600px' }}
                                    />
                                </a>
                            ) : (
                                <img
                                    src={imageUrl}
                                    className="w-full h-full object-contain rounded-2xl"
                                    alt="Resume preview"
                                    style={{ maxWidth: '400px', maxHeight: '600px' }}
                                />
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center text-gray-500">
                                <div className="text-4xl mb-2">📄</div>
                                <p>Resume preview loading...</p>
                                {resumeUrl && (
                                    <a 
                                        href={resumeUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-blue-500 underline mt-2 inline-block"
                                    >
                                        View PDF
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                </section>
                <section className="feedback-section">
                    <h2 className="text-4xl !text-black font-bold">Resume Review</h2>
                    {feedback ? (
                        <div className="flex flex-col gap-8 animate-in fade-in duration-1000">
                            <Summary feedback={feedback} />
                            <ATS score={feedback.ATS?.score || 0} suggestions={feedback.ATS?.tips || []} />
                            <Details feedback={feedback} />
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <img src="/images/resume-scan-2.gif" className="w-64 mx-auto mb-4" />
                            <p className="text-lg text-gray-600">Generating your analysis...</p>
                            <p className="text-sm text-gray-500 mt-2">This usually takes 30-60 seconds</p>
                        </div>
                    )}
                </section>
            </div>
        </main>
    )
}

export default Resume