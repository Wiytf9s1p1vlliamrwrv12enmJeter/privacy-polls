# Privacy-Preserving Polling Platform

A privacy-first digital platform enabling secure and anonymous citizen participation in surveys and democratic decision-making. Citizens can submit votes or responses to sensitive questions while remaining completely anonymous. The system aggregates results using homomorphic encryption, ensuring that no individual response is exposed while delivering accurate real-time statistics.

## Project Background

Conventional polling and voting systems face several challenges:

* **Privacy Concerns:** Respondents may be reluctant to share opinions on sensitive topics due to fear of identification or retaliation.
* **Data Integrity Issues:** Centralized authorities could tamper with votes or selectively release results.
* **Limited Transparency:** Citizens cannot verify whether their votes were counted accurately.
* **Statistical Limitations:** Aggregated results may be delayed, incomplete, or unreliable due to privacy restrictions.

Our platform addresses these problems by leveraging **Full Homomorphic Encryption (FHE)**. With FHE, all votes are encrypted at submission and remain encrypted during aggregation. The system can compute totals, averages, and other statistics directly on encrypted data, preventing any exposure of individual responses.

## Key Features

### Core Functionality

* **Anonymous Polling:** Citizens submit encrypted votes or survey responses with complete anonymity.
* **Real-Time Aggregation:** Vote counts and survey statistics are computed on encrypted data without decryption.
* **Prevent Double Voting:** Ensures each participant can submit only once without revealing identity.
* **Publicly Verifiable Results:** Aggregated statistics are visible to all users, fostering trust.
* **Multi-Question Support:** Polls can include multiple questions with different answer types (single choice, multiple choice, numeric ratings).

### Privacy and Security

* **Client-Side Encryption:** All votes are encrypted locally before leaving the user’s device.
* **Fully Anonymous Participation:** No user identifiers, accounts, or metadata are collected.
* **Immutable Records:** Votes are stored securely and cannot be modified or deleted.
* **Encrypted Computation:** Aggregation is performed directly on encrypted votes using FHE.

### Transparency

* **Auditability:** All submission events and aggregation steps are publicly verifiable without compromising privacy.
* **Tamper-Resistant Storage:** Votes and statistics are recorded in a distributed ledger for immutability.
* **Open Aggregation Logic:** Aggregation algorithms are auditable and deterministic, ensuring fairness.

## Architecture

### Backend & Smart Contracts

* **VoteManager.sol** (Ethereum-based smart contract)

  * Handles submission of encrypted votes
  * Maintains immutable encrypted vote storage
  * Performs on-chain aggregation or triggers off-chain FHE computation
  * Publishes aggregated results for public verification

* **FHE Aggregation Engine**

  * Computes total votes, averages, and other statistics on encrypted inputs
  * Returns only the final decrypted statistics, never exposing individual votes

### Frontend Application

* **React + TypeScript**: Interactive web interface for submitting and viewing polls
* **Real-Time Dashboard**: Displays live statistics as soon as aggregation is completed
* **Accessibility Features**: Supports multiple devices and screen readers
* **Wallet Integration (Optional)**: Users can optionally sign submissions with a blockchain wallet for auditability

### Technology Stack

#### Blockchain

* **Solidity ^0.8.24**: Smart contract development
* **Hardhat**: Testing and deployment
* **Ethereum Sepolia Testnet**: Deployment environment
* **OpenZeppelin Libraries**: Security and contract patterns

#### Frontend

* **React 18 + TypeScript**: Modern, responsive interface
* **Ethers.js**: Blockchain interaction
* **Tailwind + CSS**: Styling and responsive layout

#### Encryption & Computation

* **Full Homomorphic Encryption (FHE)**: Enables aggregation on encrypted votes
* **WebAssembly or Rust Backend**: Performs encrypted computation efficiently

## Installation

### Prerequisites

* Node.js 18+
* npm / yarn / pnpm
* Optional: Ethereum wallet for audit signing

### Setup Steps

1. Clone repository and install dependencies:

   ```bash
   npm install
   ```
2. Compile smart contracts:

   ```bash
   npx hardhat compile
   ```
3. Deploy contracts to testnet:

   ```bash
   npx hardhat run scripts/deploy.js --network sepolia
   ```
4. Start frontend server:

   ```bash
   npm start
   ```

## Usage

* **Submit a Vote:** Enter answers to poll questions; encryption occurs on your device.
* **View Polls:** Browse all active surveys and view aggregated results.
* **Real-Time Statistics:** Check live totals, averages, and percentages for each option.
* **Audit History:** Verify submission and aggregation events directly on-chain.

## Security Measures

* **Encryption at Source:** Votes never leave the user device in plaintext.
* **Homomorphic Aggregation:** Ensures computations are performed securely without decryption.
* **Immutable Ledger:** Tamper-proof storage of encrypted submissions.
* **Anonymous Participation:** No IP tracking, accounts, or personal identifiers collected.
* **Verification:** Transparent aggregation ensures results can be audited by any participant.

## Roadmap

* **Multi-Question FHE Optimization:** Support simultaneous computation of multiple question results.
* **Threshold Alerts:** Trigger notifications when certain thresholds are met in votes.
* **Cross-Chain Support:** Deploy on multiple blockchains for redundancy and accessibility.
* **Mobile App:** Native iOS/Android application for broader citizen engagement.
* **DAO Governance:** Allow citizens or organizations to propose and approve new polls.
* **Statistical Analytics:** Advanced encrypted analytics for public decision-making insights.

## Why FHE Matters

Full Homomorphic Encryption enables the platform to perform meaningful aggregation while maintaining full privacy. Unlike traditional encryption where decryption is required for computation, FHE allows direct computation on encrypted data. This is critical for democratic processes:

* Citizens’ choices remain confidential.
* Government or poll organizers cannot infer individual responses.
* Results are trustworthy and verifiable.
* Participation rates improve because anonymity is guaranteed.

With FHE, the platform achieves **both privacy and transparency**, solving a central dilemma in sensitive polling and democratic decision-making.

Built with ❤️ for privacy, transparency, and citizen empowerment.
