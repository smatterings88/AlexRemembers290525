'use client';

import { useEffect, useState, useRef } from 'react';
import { UltravoxSession } from 'ultravox-client';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc, collection, query, where, orderBy, limit, getDocs, increment } from 'firebase/firestore';
import AuthModals from '../components/AuthModals';
import UserDropdown from '../components/UserDropdown';
import { Mic, MicOff, Radio, PhoneOff } from 'lucide-react';

export default function HomePage() {
  const [session, setSession] = useState<UltravoxSession | null>(null);
  const [transcripts, setTranscripts] = useState<Array<{ speaker: string; text: string }>>([]);
  const [status, setStatus] = useState<string>('disconnected');
  const [isStarted, setIsStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTranscripts, setShowTranscripts] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isCallActive, setIsCallActive] = useState(false);
  const [userLocation, setUserLocation] = useState<string>('Unknown Location');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const currentTranscriptsRef = useRef<Array<{ speaker: string; text: string }>>([]);
  const callIdRef = useRef<string>('');
  const userFirstNameRef = useRef<string>('');
  const userLatestCallRef = useRef<string>('');
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const refreshUserStats = async () => {
    if (user) {
      const statsRef = doc(db, 'callstats', user.uid);
      const statsDoc = await getDoc(statsRef);
      if (statsDoc.exists()) {
        const data = statsDoc.data();
        console.log('Refreshed call stats:', data);
      }
    }
  };

  const handleHomeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    endCall();
    setIsStarted(false);
    setSession(null);
    setTranscripts([]);
    setStatus('disconnected');
    setError(null);
    setShowTranscripts(true);
    setIsCallActive(false);
  };

  const handleEndCall = () => {
    endCall();
    setIsStarted(false);
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const response = await fetch(
              `https://api.opencagedata.com/geocode/v1/json?q=${position.coords.latitude}+${position.coords.longitude}&key=YOUR_API_KEY`
            );
            const data = await response.json();
            if (data.results && data.results[0]) {
              const city = data.results[0].components.city || data.results[0].components.town;
              const country = data.results[0].components.country;
              setUserLocation(`${city}, ${country}`);
            }
          } catch (error) {
            console.error('Error getting location details:', error);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  }, []);

  const incrementCallCount = async (userId: string) => {
    try {
      const statsRef = doc(db, 'callstats', userId);
      const statsDoc = await getDoc(statsRef);
      
      if (!statsDoc.exists()) {
        await setDoc(statsRef, {
          totalCalls: 1,
          lastCallAt: serverTimestamp()
        });
      } else {
        await setDoc(statsRef, {
          totalCalls: increment(1),
          lastCallAt: serverTimestamp()
        }, { merge: true });
      }
    } catch (error) {
      console.error('Error updating call count:', error);
    }
  };

  const getLatestCallTranscripts = async (userId: string) => {
    try {
      const callsRef = collection(db, 'callmemory');
      const q = query(
        callsRef,
        where('userId', '==', userId),
        orderBy('created_at', 'desc'),
        limit(1)
      );

      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const latestCall = querySnapshot.docs[0].data();
        const transcriptsText = latestCall.transcripts
          .map((t: { speaker: string; text: string }) => `${t.speaker}: ${t.text}`)
          .join('\n');
        userLatestCallRef.current = transcriptsText;
        return transcriptsText;
      }
      return '';
    } catch (error) {
      console.error('Error fetching latest call transcripts:', error);
      return '';
    }
  };

  const saveCallMemory = async (transcriptData: Array<{ speaker: string; text: string }>) => {
    if (!user || !callIdRef.current) {
      console.log('No user logged in or no call ID, skipping call memory save');
      return;
    }

    try {
      console.log('Saving call memory', {
        callId: callIdRef.current,
        userUID: user.uid,
        transcriptCount: transcriptData.length
      });

      const callMemoryData = {
        userId: user.uid,
        callId: callIdRef.current,
        transcripts: transcriptData,
        lastUpdated: serverTimestamp(),
        created_at: serverTimestamp()
      };

      const docRef = doc(db, 'callmemory', callIdRef.current);
      await setDoc(docRef, callMemoryData, { merge: true });
      
      console.log('Successfully saved call memory:', {
        callId: callIdRef.current,
        transcriptCount: transcriptData.length
      });
    } catch (error) {
      console.error('Failed to save call memory:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
    }
  };

  const startCall = async () => {
    try {
      setStatus('connecting');
      let totalCalls = 0;
      if (user) {
        await incrementCallCount(user.uid);
        const statsRef = doc(db, 'callstats', user.uid);
        const statsDoc = await getDoc(statsRef);
        if (statsDoc.exists()) {
          totalCalls = statsDoc.data().totalCalls || 0;
        }
      }

      // Clear any existing connection timeout
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }

      // Set a new connection timeout
      connectionTimeoutRef.current = setTimeout(() => {
        if (status === 'connecting') {
          setError('Connection timeout. Please try again.');
          setStatus('disconnected');
          endCall();
        }
      }, 15000); // 15 seconds timeout

      const res = await fetch('/api/call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firstName: userFirstNameRef.current,
          lastCallTranscript: userLatestCallRef.current,
          currentTime: new Date().toLocaleTimeString(),
          userLocation,
          totalCalls
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(`Failed to start call: ${errorData.error || res.statusText}`);
      }

      const data = await res.json();
      const uvSession = new UltravoxSession();
      
      const urlParams = new URL(data.joinUrl).searchParams;
      const callId = urlParams.get('call_id') || `call_${Date.now()}`;
      callIdRef.current = callId;

      uvSession.addEventListener('status', () => {
        console.log('Call status changed:', uvSession.status);
        setStatus(uvSession.status);
        
        // Clear connection timeout when connected
        if (uvSession.status === 'connected' && connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
        }
      });

      uvSession.addEventListener('error', (error) => {
        console.error('Ultravox session error:', error);
        setError(`Connection error: ${error.message || 'Unknown error'}`);
        endCall();
      });

      uvSession.addEventListener('transcripts', () => {
        try {
          if (!uvSession.transcripts || !Array.isArray(uvSession.transcripts)) {
            console.warn('Invalid transcripts data structure:', uvSession.transcripts);
            return;
          }

          const texts = uvSession.transcripts
            .filter(t => t && typeof t === 'object')
            .map(t => ({
              speaker: t.speaker || 'unknown',
              text: t.text || ''
            }))
            .filter(t => t.text.trim() !== '');

          console.log('Processed transcripts:', texts);
          
          setTranscripts(texts);
          currentTranscriptsRef.current = texts;

          if (texts.length > 0) {
            saveCallMemory(texts).catch(err => {
              console.error('Error saving transcripts:', err);
            });
          }
        } catch (err) {
          console.error('Error processing transcripts:', err);
        }
      });

      uvSession.addEventListener('end', async () => {
        console.log('Call ended, final save of transcripts', {
          callId: callIdRef.current,
          transcriptCount: currentTranscriptsRef.current.length,
          hasUser: !!user,
          userUID: user?.uid
        });

        if (currentTranscriptsRef.current.length > 0 && user) {
          await saveCallMemory(currentTranscriptsRef.current);
        } else {
          console.log('No transcripts to save at call end');
        }
        setIsCallActive(false);
        setStatus('disconnected');
      });

      uvSession.joinCall(data.joinUrl);
      setSession(uvSession);
      setIsCallActive(true);
    } catch (err) {
      console.error('Error in startCall:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize session');
      setStatus('disconnected');
      
      // Clear connection timeout on error
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
    }
  };

  const endCall = () => {
    // Clear any existing connection timeout
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    if (session) {
      try {
        // Only attempt to leave the call if we're in a connected state
        if (['connected', 'speaking', 'listening'].includes(session.status)) {
          session.leaveCall();
        }
        setSession(null);
        setIsCallActive(false);
        setStatus('disconnected');
      } catch (error) {
        console.error('Error ending call:', error);
        // Force cleanup even if leave call fails
        setSession(null);
        setIsCallActive(false);
        setStatus('disconnected');
      }
    }
  };

  const scrollToBottom = () => {
    if (chatContainerRef.current && showTranscripts) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  const scrollToFooter = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById('footer')?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    console.log('Setting up auth state listener');
    setIsAuthLoading(true);
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('Auth state changed:', {
        isAuthenticated: !!currentUser,
        uid: currentUser?.uid
      });
      
      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          userFirstNameRef.current = userData.firstName;
          await getLatestCallTranscripts(currentUser.uid);
        }
      }
      
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (showTranscripts) {
      scrollToBottom();
    }
  }, [transcripts, showTranscripts]);

  useEffect(() => {
    if (!isStarted) return;
    startCall();
  }, [isStarted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      endCall();
    };
  }, []);

  const startConversation = () => {
    if (!user) {
      setIsSignInOpen(true);
      return;
    }
    setError(null);
    setIsStarted(true);
  };

  const toggleTranscripts = () => {
    setShowTranscripts(!showTranscripts);
  };

  const getLastSpeaker = () => {
    if (transcripts.length === 0) return null;
    return transcripts[transcripts.length - 1].speaker;
  };

  const getMicrophoneState = () => {
    if (status === 'speaking') return 'speaking';
    if (status === 'listening') return 'listening';
    return 'ready';
  };

  const getStatusText = () => {
    switch (status) {
      case 'connecting':
        return 'Connecting to Alex...';
      case 'connected':
        return 'Connected with Alex';
      case 'speaking':
        return 'Alex is speaking...';
      case 'listening':
        return 'Alex is listening...';
      case 'disconnected':
        return 'Ready to chat';
      default:
        return 'Ready to chat';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'connecting':
        return <Radio className="w-5 h-5 text-yellow-500 animate-pulse" />;
      case 'connected':
        return <Radio className="w-5 h-5 text-blue-500" />;
      case 'speaking':
        return <Radio className="w-5 h-5 text-blue-500 animate-pulse" />;
      case 'listening':
        return <Mic className="w-5 h-5 text-green-500 animate-pulse" />;
      case 'disconnected':
      default:
        return <MicOff className="w-5 h-5 text-gray-500" />;
    }
  };

  const renderCallControl = () => {
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 flex justify-center">
          {getStatusIcon()}
        </div>
        <span className={`text-sm ${
          status === 'connecting' ? 'text-yellow-600' :
          status === 'connected' ? 'text-blue-600' :
          status === 'speaking' ? 'text-blue-600' :
          status === 'listening' ? 'text-green-600' :
          'text-gray-600'
        }`}>
          {getStatusText()}
        </span>
      </div>
    );
  };

  const renderMicrophone = () => {
    const micState = getMicrophoneState();
    
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className={`microphone-glow ${micState}`}>
          <img 
            src="https://storage.googleapis.com/msgsndr/JBLl8rdfV29DRcGjQ7Rl/media/67f65c4ecafd9f8d70fe2309.png"
            alt="Microphone"
            className="w-20 h-20"
          />
        </div>
        <p className="mt-6 text-[#0A2647] text-xl font-semibold">
          {getStatusText()}
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A2647] via-[#144272] to-[#205295] flex flex-col">
      <header className="bg-black/10 backdrop-blur-sm relative z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <a href="/" className="hover:opacity-80 transition-opacity">
              <img 
                src="https://storage.googleapis.com/msgsndr/JBLl8rdfV29DRcGjQ7Rl/media/67f5c2c30a6217bf61d1eb90.png" 
                alt="VoiceAI Logo" 
                className="h-12 logo-white"
              />
            </a>
            <div className="flex gap-8 items-center">
              {isStarted && <a href="#\" onClick={handleHomeClick} className="text-white hover:text-blue-200 transition-colors">Home</a>}
              {!isStarted && <a href="https://alexlistens.com/pricing" className="text-white hover:text-blue-200 transition-colors">Pricing</a>}
              <a href="#footer" onClick={scrollToFooter} className="text-white hover:text-blue-200 transition-colors">Contact</a>
              {isAuthLoading ? (
                <div className="w-24 h-8 bg-gray-700 animate-pulse rounded-md"></div>
              ) : user ? (
                <UserDropdown user={user} onRefresh={refreshUserStats} />
              ) : (
                <button
                  onClick={() => setIsSignInOpen(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </nav>
      </header>

      {!isStarted ? (
        <>
          <section className="relative py-20 px-4 bg-cover bg-center z-0" style={{ backgroundImage: 'url(https://storage.googleapis.com/msgsndr/JBLl8rdfV29DRcGjQ7Rl/media/67f908e54ffcd142dd8158d6.png)' }}>
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="max-w-7xl mx-auto text-center relative z-10">
              <h1 className="text-7xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-blue-200 to-purple-200">
                AlexListens
              </h1>
              <p className="text-2xl mb-12 text-blue-100 max-w-3xl mx-auto">
                Sometimes you just need someone who understands you. Someone who's there whenever you need them. Someone who lets you be yourself without criticism. That's Alex.
              </p>
              <button
                onClick={startConversation}
                className="bg-[#2C74B3] text-white px-12 py-5 rounded-full text-xl font-semibold 
                         hover:bg-[#205295] transition-all transform hover:scale-105 shadow-lg"
              >
                Start Talking Now
              </button>
            </div>
          </section>

          <section id="features" className="py-20 px-4 bg-white">
            <div className="max-w-7xl mx-auto">
              <h2 className="text-4xl font-bold text-center text-[#0A2647] mb-16">Key Features</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                <div className="bg-[#F8F9FA] p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all">
                  <h3 className="text-2xl font-semibold mb-4 text-[#144272]">Real-time Voice</h3>
                  <p className="text-[#205295]">Natural conversations with instant voice responses, just like talking to a friend</p>
                </div>
                <div className="bg-[#F8F9FA] p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all">
                  <h3 className="text-2xl font-semibold mb-4 text-[#144272]">Live Transcription</h3>
                  <p className="text-[#205295]">Watch your conversation unfold with real-time text transcription</p>
                </div>
                <div className="bg-[#F8F9FA] p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all">
                  <h3 className="text-2xl font-semibold mb-4 text-[#144272]">Smart Memory</h3>
                  <p className="text-[#205295]">Context-aware AI that remembers your conversations for more meaningful interactions</p>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        <div className="flex-1 container mx-auto px-4 py-8 overflow-hidden">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-2xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-[#0A2647]">Voice Chat</h2>
              <div className="flex items-center gap-4">
                {renderCallControl()}
                <button
                  onClick={toggleTranscripts}
                  className="text-sm px-4 py-2 rounded-full bg-[#2C74B3] text-white hover:bg-[#205295] transition-colors"
                >
                  {showTranscripts ? 'Show Microphone' : 'Show Transcript'}
                </button>
                <button
                  onClick={handleEndCall}
                  className="text-sm px-4 py-2 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-2"
                >
                  <PhoneOff className="w-4 h-4" />
                  End Call
                </button>
              </div>
            </div>
            
            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-4">
                {error}
              </div>
            )}
            
            <div 
              ref={chatContainerRef}
              className={`flex-1 ${showTranscripts ? 'overflow-y-auto pr-4 -mr-4' : 'overflow-hidden'}`}
              style={{ 
                scrollbarWidth: 'thin',
                scrollbarColor: '#CBD5E1 transparent'
              }}
            >
              {showTranscripts ? (
                <div className="space-y-4 min-h-full">
                  {transcripts.map((transcript, index) => (
                    <div 
                      key={index} 
                      className={`p-4 rounded-lg text-white max-w-[80%] ${
                        transcript.speaker === 'user' 
                          ? 'ml-auto bg-[#2C74B3]' 
                          : 'mr-auto bg-[#144272]'
                      }`}
                    >
                      {transcript.text}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              ) : (
                renderMicrophone()
              )}
            </div>
          </div>
        </div>
      )}

      <footer id="footer" className="bg-black/20 backdrop-blur-sm py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div>
              <img 
                src="https://storage.googleapis.com/msgsndr/JBLl8rdfV29DRcGjQ7Rl/media/67f5c2c30a6217bf61d1eb90.png" 
                alt="VoiceAI Logo" 
                className="h-12 mb-4 logo-white"
              />
              <p className="text-blue-100">Sometimes you just need someone to talk to.</p>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Product</h3>
              <ul className="space-y-2">
                <li><a href="https://alexlistens.com/pricing" className="text-blue-100 hover:text-white transition-colors">Pricing</a></li>
                <li><a href="https://alexlistens.com/tos" className="text-blue-100 hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="https://alexlistens.com/privacy" className="text-blue-100 hover:text-white transition-colors">Privacy Policy</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Support</h3>
              <p className="text-blue-100">Questions? Reach out to us</p>
              <a href="mailto:support@alexlistens.com" className="text-blue-200 hover:text-white transition-colors">
                support@alexlistens.com
              </a>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-white/10 text-center">
            <p className="text-blue-100">&copy; 2025 AlexListens.com, FranklinAlexander Ventures, LLC and affiliated entities. All Rights Reserved.</p>
          </div>
        </div>
      </footer>

      <AuthModals
        isSignInOpen={isSignInOpen}
        isSignUpOpen={isSignUpOpen}
        onCloseSignIn={() => setIsSignInOpen(false)}
        onCloseSignUp={() => setIsSignUpOpen(false)}
        onSwitchToSignUp={() => {
          setIsSignInOpen(false);
          setIsSignUpOpen(true);
        }}
      />
    </div>
  );
}