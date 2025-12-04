# Privacy-Preserving Democratic Polls Smart Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract PrivacyPollsFHE is SepoliaConfig {

    struct EncryptedVote {
        uint256 voterId;
        euint32 encryptedChoice; // Encrypted vote choice
        uint256 timestamp;
    }

    struct DecryptedResult {
        string choice;
        uint32 count;
    }

    uint256 public voteCount;
    mapping(uint256 => EncryptedVote) public encryptedVotes;
    mapping(string => euint32) private encryptedChoiceCount;
    string[] private choiceList;

    mapping(uint256 => uint256) private decryptionRequests;

    event VoteSubmitted(uint256 indexed voterId, uint256 timestamp);
    event DecryptionRequested(uint256 indexed requestId);
    event VoteCountDecrypted(string choice, uint32 count);

    modifier onlyVoter(uint256 voterId) {
        // Placeholder for access control logic
        _;
    }

    /// @notice Submit a new encrypted vote
    function submitEncryptedVote(
        uint256 voterId,
        euint32 encryptedChoice
    ) public {
        voteCount += 1;
        encryptedVotes[voteCount] = EncryptedVote({
            voterId: voterId,
            encryptedChoice: encryptedChoice,
            timestamp: block.timestamp
        });

        // Initialize choice in count mapping
        if (!FHE.isInitialized(encryptedChoiceCount[bytes32ToString(FHE.toBytes32(encryptedChoice))])) {
            string memory choiceStr = bytes32ToString(FHE.toBytes32(encryptedChoice));
            encryptedChoiceCount[choiceStr] = FHE.asEuint32(0);
            choiceList.push(choiceStr);
        }

        emit VoteSubmitted(voterId, block.timestamp);
    }

    /// @notice Aggregate encrypted votes
    function aggregateVotes() public {
        for (uint i = 0; i < voteCount; i++) {
            EncryptedVote storage v = encryptedVotes[i + 1];
            string memory choiceStr = bytes32ToString(FHE.toBytes32(v.encryptedChoice));
            encryptedChoiceCount[choiceStr] = FHE.add(
                encryptedChoiceCount[choiceStr],
                FHE.asEuint32(1)
            );
        }
    }

    /// @notice Request decryption of aggregated vote count
    function requestChoiceDecryption(string memory choice) public {
        euint32 count = encryptedChoiceCount[choice];
        require(FHE.isInitialized(count), "Choice not found");

        bytes32 ;
        ciphertexts[0] = FHE.toBytes32(count);

        uint256 reqId = FHE.requestDecryption(ciphertexts, this.decryptChoiceCount.selector);
        decryptionRequests[reqId] = bytes32ToUint(keccak256(abi.encodePacked(choice)));

        emit DecryptionRequested(reqId);
    }

    /// @notice Callback for decrypted choice count
    function decryptChoiceCount(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        uint256 choiceHash = decryptionRequests[requestId];
        string memory choice = getChoiceFromHash(choiceHash);

        FHE.checkSignatures(requestId, cleartexts, proof);

        uint32 count = abi.decode(cleartexts, (uint32));

        emit VoteCountDecrypted(choice, count);
    }

    /// @notice Get encrypted vote count for a choice
    function getEncryptedChoiceCount(string memory choice) public view returns (euint32) {
        return encryptedChoiceCount[choice];
    }

    // Helper function to convert bytes32 to string
    function bytes32ToString(bytes32 b) private pure returns (string memory) {
        bytes memory bytesArray = new bytes(32);
        for (uint256 i; i < 32; i++) {
            bytesArray[i] = b[i];
        }
        return string(bytesArray);
    }

    // Helper function to convert bytes32 hash to uint
    function bytes32ToUint(bytes32 b) private pure returns (uint256) {
        return uint256(b);
    }

    // Helper function to find choice string by hash
    function getChoiceFromHash(uint256 hash) private view returns (string memory) {
        for (uint i = 0; i < choiceList.length; i++) {
            if (bytes32ToUint(keccak256(abi.encodePacked(choiceList[i]))) == hash) {
                return choiceList[i];
            }
        }
        revert("Choice not found");
    }

    /// @notice Get list of choices
    function getChoiceList() public view returns (string[] memory) {
        return choiceList;
    }
}
