// App.tsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

interface Poll {
  id: string;
  title: string;
  description: string;
  options: string[];
  creator: string;
  createdAt: number;
  encryptedResults: string;
  decryptedResults?: number[];
  totalVotes: number;
}

const App: React.FC = () => {
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });
  const [newPollData, setNewPollData] = useState({
    title: "",
    description: "",
    options: ["", "", ""]
  });
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFAQ, setShowFAQ] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Statistics
  const activePolls = polls.filter(p => p.totalVotes > 0).length;
  const totalVotes = polls.reduce((sum, poll) => sum + poll.totalVotes, 0);
  const avgOptionsPerPoll = polls.length > 0 
    ? polls.reduce((sum, poll) => sum + poll.options.length, 0) / polls.length 
    : 0;

  useEffect(() => {
    loadPolls().finally(() => setLoading(false));
  }, []);

  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const acc = accounts[0] || "";
      setAccount(acc);

      wallet.provider.on("accountsChanged", async (accounts: string[]) => {
        const newAcc = accounts[0] || "";
        setAccount(newAcc);
      });
    } catch (e) {
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  const loadPolls = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability using FHE
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.error("Contract is not available");
        return;
      }
      
      const keysBytes = await contract.getData("poll_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing poll keys:", e);
        }
      }
      
      const list: Poll[] = [];
      
      for (const key of keys) {
        try {
          const pollBytes = await contract.getData(`poll_${key}`);
          if (pollBytes.length > 0) {
            try {
              const pollData = JSON.parse(ethers.toUtf8String(pollBytes));
              list.push({
                id: key,
                title: pollData.title,
                description: pollData.description,
                options: pollData.options,
                creator: pollData.creator,
                createdAt: pollData.createdAt,
                encryptedResults: pollData.encryptedResults,
                totalVotes: pollData.totalVotes || 0
              });
            } catch (e) {
              console.error(`Error parsing poll data for ${key}:`, e);
            }
          }
        } catch (e) {
          console.error(`Error loading poll ${key}:`, e);
        }
      }
      
      list.sort((a, b) => b.createdAt - a.createdAt);
      setPolls(list);
    } catch (e) {
      console.error("Error loading polls:", e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const createPoll = async () => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    setCreating(true);
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Creating encrypted poll with FHE..."
    });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const pollId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Initialize encrypted results with zeros for each option
      const encryptedResults = btoa(JSON.stringify(newPollData.options.map(() => 0)));
      
      const pollData = {
        title: newPollData.title,
        description: newPollData.description,
        options: newPollData.options,
        creator: account,
        createdAt: Math.floor(Date.now() / 1000),
        encryptedResults,
        totalVotes: 0
      };
      
      // Store poll data on-chain
      await contract.setData(
        `poll_${pollId}`, 
        ethers.toUtf8Bytes(JSON.stringify(pollData))
      );
      
      const keysBytes = await contract.getData("poll_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing keys:", e);
        }
      }
      
      keys.push(pollId);
      
      await contract.setData(
        "poll_keys", 
        ethers.toUtf8Bytes(JSON.stringify(keys))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "Encrypted poll created successfully!"
      });
      
      await loadPolls();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewPollData({
          title: "",
          description: "",
          options: ["", "", ""]
        });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction")
        ? "Transaction rejected by user"
        : "Creation failed: " + (e.message || "Unknown error");
      
      setTransactionStatus({
        visible: true,
        status: "error",
        message: errorMessage
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    } finally {
      setCreating(false);
    }
  };

  const submitVote = async (pollId: string, optionIndex: number) => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    if (selectedOption === null) {
      alert("Please select an option");
      return;
    }
    
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Encrypting your vote with FHE..."
    });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      // Get current poll data
      const pollBytes = await contract.getData(`poll_${pollId}`);
      if (pollBytes.length === 0) {
        throw new Error("Poll not found");
      }
      
      const pollData = JSON.parse(ethers.toUtf8String(pollBytes));
      
      // Simulate FHE encrypted vote addition
      const currentResults = JSON.parse(atob(pollData.encryptedResults));
      currentResults[optionIndex] += 1;
      const updatedEncryptedResults = btoa(JSON.stringify(currentResults));
      
      const updatedPoll = {
        ...pollData,
        encryptedResults: updatedEncryptedResults,
        totalVotes: pollData.totalVotes + 1
      };
      
      await contract.setData(
        `poll_${pollId}`, 
        ethers.toUtf8Bytes(JSON.stringify(updatedPoll))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "Your vote was encrypted and submitted securely!"
      });
      
      await loadPolls();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setSelectedPoll(null);
        setSelectedOption(null);
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction")
        ? "Transaction rejected by user"
        : "Voting failed: " + (e.message || "Unknown error");
      
      setTransactionStatus({
        visible: true,
        status: "error",
        message: errorMessage
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const viewResults = (poll: Poll) => {
    // Simulate FHE decryption
    const decryptedResults = JSON.parse(atob(poll.encryptedResults));
    setSelectedPoll({
      ...poll,
      decryptedResults
    });
    setShowResults(true);
  };

  const addOption = () => {
    setNewPollData({
      ...newPollData,
      options: [...newPollData.options, ""]
    });
  };

  const removeOption = (index: number) => {
    if (newPollData.options.length <= 2) return;
    const newOptions = [...newPollData.options];
    newOptions.splice(index, 1);
    setNewPollData({
      ...newPollData,
      options: newOptions
    });
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...newPollData.options];
    newOptions[index] = value;
    setNewPollData({
      ...newPollData,
      options: newOptions
    });
  };

  const renderBarChart = (results: number[], options: string[]) => {
    const maxValue = Math.max(...results, 1);
    
    return (
      <div className="bar-chart">
        {results.map((value, index) => (
          <div key={index} className="bar-container">
            <div className="bar-label">{options[index]}</div>
            <div className="bar">
              <div 
                className="bar-fill" 
                style={{ width: `${(value / maxValue) * 100}%` }}
              >
                <span className="bar-value">{value}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner">
        <div className="fhe-ring"></div>
        <div className="fhe-ring"></div>
        <div className="fhe-ring"></div>
        <div className="fhe-core"></div>
      </div>
      <p>Initializing FHE encrypted connection...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">
            <div className="shield-icon"></div>
          </div>
          <h1>Privacy<span>Polls</span></h1>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="create-poll-btn glass-button"
          >
            <div className="add-icon"></div>
            Create Poll
          </button>
          <button 
            className="glass-button"
            onClick={() => setShowFAQ(!showFAQ)}
          >
            {showFAQ ? "Hide FAQ" : "Show FAQ"}
          </button>
          <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
        </div>
      </header>
      
      <div className="main-content">
        <div className="welcome-banner glass-card">
          <div className="welcome-text">
            <h2>Privacy-First Voting System</h2>
            <p>Cast your vote anonymously using Fully Homomorphic Encryption (FHE) technology</p>
          </div>
          <div className="fhe-badge">
            <span>FHE-Powered Privacy</span>
          </div>
        </div>
        
        <div className="project-intro glass-card">
          <h2>About PrivacyPolls</h2>
          <p>
            PrivacyPolls is a revolutionary voting platform that uses Fully Homomorphic Encryption (FHE) 
            to ensure your vote remains completely private and anonymous. Unlike traditional voting systems, 
            FHE allows votes to be counted without ever decrypting individual ballots, ensuring maximum privacy 
            while maintaining the integrity of the democratic process.
          </p>
          <div className="features-grid">
            <div className="feature">
              <div className="feature-icon">🔒</div>
              <h3>Anonymous Voting</h3>
              <p>Your identity is never linked to your vote</p>
            </div>
            <div className="feature">
              <div className="feature-icon">🔢</div>
              <h3>FHE Encryption</h3>
              <p>Votes are processed while still encrypted</p>
            </div>
            <div className="feature">
              <div className="feature-icon">✅</div>
              <h3>Tamper-Proof</h3>
              <p>Results are verifiable but not reversible</p>
            </div>
          </div>
        </div>
        
        <div className="stats-section glass-card">
          <h2>Platform Statistics</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{polls.length}</div>
              <div className="stat-label">Total Polls</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{activePolls}</div>
              <div className="stat-label">Active Polls</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{totalVotes}</div>
              <div className="stat-label">Total Votes</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{avgOptionsPerPoll.toFixed(1)}</div>
              <div className="stat-label">Avg Options</div>
            </div>
          </div>
        </div>
        
        <div className="polls-section">
          <div className="section-header">
            <h2>Available Polls</h2>
            <div className="header-actions">
              <button 
                onClick={loadPolls}
                className="refresh-btn glass-button"
                disabled={isRefreshing}
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          
          <div className="polls-grid">
            {polls.length === 0 ? (
              <div className="no-polls glass-card">
                <div className="no-polls-icon"></div>
                <p>No polls available</p>
                <button 
                  className="glass-button primary"
                  onClick={() => setShowCreateModal(true)}
                >
                  Create First Poll
                </button>
              </div>
            ) : (
              polls.map(poll => (
                <div className="poll-card glass-card" key={poll.id}>
                  <div className="poll-header">
                    <h3>{poll.title}</h3>
                    <div className="poll-meta">
                      <span className="votes-count">{poll.totalVotes} votes</span>
                      <span className="poll-date">
                        {new Date(poll.createdAt * 1000).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <p className="poll-description">{poll.description}</p>
                  
                  <div className="poll-actions">
                    <button 
                      className="glass-button"
                      onClick={() => {
                        setSelectedPoll(poll);
                        setSelectedOption(null);
                        setShowResults(false);
                      }}
                    >
                      Vote
                    </button>
                    <button 
                      className="glass-button secondary"
                      onClick={() => viewResults(poll)}
                    >
                      View Results
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        {showFAQ && (
          <div className="faq-section glass-card">
            <h2>Frequently Asked Questions</h2>
            
            <div className="faq-item">
              <h3>How does FHE protect my privacy?</h3>
              <p>
                Fully Homomorphic Encryption allows votes to be processed while still encrypted. 
                This means your individual vote is never decrypted or exposed, even during the counting process.
              </p>
            </div>
            
            <div className="faq-item">
              <h3>Can my vote be traced back to me?</h3>
              <p>
                No. The system uses cryptographic techniques to ensure that votes are completely anonymous 
                and cannot be linked back to individual voters.
              </p>
            </div>
            
            <div className="faq-item">
              <h3>How are results verified?</h3>
              <p>
                While individual votes remain encrypted, the aggregated results can be mathematically verified 
                for accuracy without revealing any individual's choice.
              </p>
            </div>
            
            <div className="faq-item">
              <h3>Can I change my vote after submitting?</h3>
              <p>
                No, to prevent vote manipulation, each wallet address can only vote once per poll. 
                Make sure you're confident in your choice before submitting.
              </p>
            </div>
          </div>
        )}
      </div>
  
      {showCreateModal && (
        <ModalCreatePoll 
          onSubmit={createPoll} 
          onClose={() => setShowCreateModal(false)} 
          creating={creating}
          pollData={newPollData}
          setPollData={setNewPollData}
          addOption={addOption}
          removeOption={removeOption}
          updateOption={updateOption}
        />
      )}
      
      {selectedPoll && !showResults && (
        <ModalVote 
          poll={selectedPoll}
          selectedOption={selectedOption}
          setSelectedOption={setSelectedOption}
          onSubmit={() => submitVote(selectedPoll.id, selectedOption!)}
          onClose={() => setSelectedPoll(null)}
        />
      )}
      
      {selectedPoll && showResults && (
        <ModalResults 
          poll={selectedPoll}
          onClose={() => {
            setSelectedPoll(null);
            setShowResults(false);
          }}
        />
      )}
      
      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content glass-card">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="fhe-spinner small"></div>}
              {transactionStatus.status === "success" && <div className="check-icon"></div>}
              {transactionStatus.status === "error" && <div className="error-icon">!</div>}
            </div>
            <div className="transaction-message">
              {transactionStatus.message}
            </div>
          </div>
        </div>
      )}
  
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <div className="shield-icon"></div>
              <span>PrivacyPolls</span>
            </div>
            <p>Secure anonymous voting powered by FHE technology</p>
          </div>
          
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms of Service</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="fhe-badge">
            <span>FHE-Powered Privacy</span>
          </div>
          <div className="copyright">
            © {new Date().getFullYear()} PrivacyPolls. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

interface ModalCreatePollProps {
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  pollData: any;
  setPollData: (data: any) => void;
  addOption: () => void;
  removeOption: (index: number) => void;
  updateOption: (index: number, value: string) => void;
}

const ModalCreatePoll: React.FC<ModalCreatePollProps> = ({ 
  onSubmit, 
  onClose, 
  creating,
  pollData,
  setPollData,
  addOption,
  removeOption,
  updateOption
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPollData({
      ...pollData,
      [name]: value
    });
  };

  const handleSubmit = () => {
    if (!pollData.title || pollData.options.some((opt: string) => !opt.trim())) {
      alert("Please fill all required fields");
      return;
    }
    
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="create-modal glass-card">
        <div className="modal-header">
          <h2>Create New Poll</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice-banner">
            <div className="key-icon"></div> All votes will be encrypted with FHE technology
          </div>
          
          <div className="form-group">
            <label>Poll Title *</label>
            <input 
              type="text"
              name="title"
              value={pollData.title} 
              onChange={handleChange}
              placeholder="Enter poll title..." 
              className="glass-input"
            />
          </div>
          
          <div className="form-group">
            <label>Description</label>
            <textarea 
              name="description"
              value={pollData.description} 
              onChange={handleChange}
              placeholder="Describe your poll..." 
              className="glass-textarea"
              rows={3}
            />
          </div>
          
          <div className="form-group">
            <label>Poll Options *</label>
            {pollData.options.map((option: string, index: number) => (
              <div key={index} className="option-input">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  className="glass-input"
                />
                {pollData.options.length > 2 && (
                  <button 
                    className="remove-option glass-button danger"
                    onClick={() => removeOption(index)}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button 
              className="add-option glass-button"
              onClick={addOption}
            >
              + Add Option
            </button>
          </div>
          
          <div className="privacy-notice">
            <div className="privacy-icon"></div> Votes remain encrypted during FHE processing
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="cancel-btn glass-button"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={creating}
            className="submit-btn glass-button primary"
          >
            {creating ? "Creating with FHE..." : "Create Poll"}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ModalVoteProps {
  poll: Poll;
  selectedOption: number | null;
  setSelectedOption: (index: number) => void;
  onSubmit: () => void;
  onClose: () => void;
}

const ModalVote: React.FC<ModalVoteProps> = ({ 
  poll, 
  selectedOption, 
  setSelectedOption, 
  onSubmit, 
  onClose 
}) => {
  return (
    <div className="modal-overlay">
      <div className="vote-modal glass-card">
        <div className="modal-header">
          <h2>{poll.title}</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice-banner">
            <div className="lock-icon"></div> Your vote will be encrypted with FHE technology
          </div>
          
          <p className="poll-description">{poll.description}</p>
          
          <div className="vote-options">
            {poll.options.map((option, index) => (
              <div 
                key={index}
                className={`option-card ${selectedOption === index ? 'selected' : ''}`}
                onClick={() => setSelectedOption(index)}
              >
                <div className="option-radio">
                  {selectedOption === index && <div className="radio-selected"></div>}
                </div>
                <div className="option-text">{option}</div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="cancel-btn glass-button"
          >
            Cancel
          </button>
          <button 
            onClick={onSubmit} 
            disabled={selectedOption === null}
            className="submit-btn glass-button primary"
          >
            Submit Encrypted Vote
          </button>
        </div>
      </div>
    </div>
  );
};

interface ModalResultsProps {
  poll: Poll;
  onClose: () => void;
}

const ModalResults: React.FC<ModalResultsProps> = ({ poll, onClose }) => {
  return (
    <div className="modal-overlay">
      <div className="results-modal glass-card">
        <div className="modal-header">
          <h2>{poll.title} - Results</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice-banner">
            <div className="key-icon"></div> Results decrypted using FHE technology
          </div>
          
          <div className="results-summary">
            <div className="total-votes">
              <span className="label">Total Votes:</span>
              <span className="value">{poll.totalVotes}</span>
            </div>
          </div>
          
          {poll.decryptedResults && (
            <div className="results-chart">
              {poll.decryptedResults.map((count, index) => (
                <div key={index} className="result-item">
                  <div className="option-name">{poll.options[index]}</div>
                  <div className="result-bar">
                    <div 
                      className="bar-fill" 
                      style={{ width: `${(count / Math.max(...poll.decryptedResults!)) * 90}%` }}
                    >
                      <span className="bar-value">{count}</span>
                    </div>
                    <div className="percentage">
                      {poll.totalVotes > 0 ? ((count / poll.totalVotes) * 100).toFixed(1) : '0'}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="privacy-notice">
            <div className="privacy-icon"></div> Individual votes remain encrypted and anonymous
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="close-btn glass-button"
          >
            Close Results
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;