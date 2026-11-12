package com.manpower.service;

import com.manpower.entity.Document;
import com.manpower.entity.Group;
import com.manpower.entity.Member;
import com.manpower.enums.MemberRole;
import com.manpower.repository.DocumentRepository;
import com.manpower.repository.GroupRepository;
import com.manpower.repository.MemberRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;


import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class DocumentService {

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private GroupRepository groupRepository;

    @Autowired
    private MemberRepository memberRepository;

    // EXISTING METHODS
    public List<Document> getAllDocuments() {
        return documentRepository.findAll();
    }

    public Optional<Document> getDocumentById(String id) {
        return documentRepository.findById(id);
    }

    public Document saveDocument(Document document) {
        return documentRepository.save(document);
    }

    public void deleteDocument(String id) {
        documentRepository.deleteById(id);
    }

    // NEW: GET DOCUMENTS BY USER'S GROUP
    public List<Document> getDocumentsByUserGroup(String userEmail) {
        Member user = memberRepository.findByEmail(userEmail)
            .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));
        
        if (user.getGroup() == null) {
            throw new RuntimeException("User is not associated with any group");
        }
        
        return documentRepository.findByGroupId(user.getGroup().getId());
    }

    // NEW: SAVE DOCUMENT WITH USER'S GROUP
    public Document saveDocumentForUser(MultipartFile file, String fileName, 
                                      String documentType, String userEmail) {
        Member user = memberRepository.findByEmail(userEmail)
            .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));
        
        if (user.getGroup() == null) {
            throw new RuntimeException("User is not associated with any group");
        }
        
        // Use provided fileName or original filename
        String actualFileName = fileName != null ? fileName : file.getOriginalFilename();
        String actualDocumentType = documentType != null ? documentType : getFileType(file.getOriginalFilename());
        
        // Save file to storage
        String filePath = saveFileToStorage(file);
        
        Document document = new Document();
        document.setFileName(actualFileName);
        document.setFilePathUrl(filePath);
        document.setDocumentType(actualDocumentType);
        document.setGroup(user.getGroup());
        document.setUploadedBy(user);
        document.setUploadDate(java.sql.Timestamp.valueOf(LocalDateTime.now()));
        document.setCreatedBy(userEmail);
        document.setModifiedBy(userEmail);
        
        return documentRepository.save(document);
    }

    // NEW: CHECK IF USER CAN DELETE DOCUMENT
    public boolean canUserDeleteDocument(String documentId, String userEmail) {
        Member user = memberRepository.findByEmail(userEmail)
            .orElseThrow(() -> new RuntimeException("User not found"));
        
        Document document = documentRepository.findById(documentId)
            .orElseThrow(() -> new RuntimeException("Document not found"));
        
        // Super Admin can delete any document
        if (user.getRole() == MemberRole.SuperAdmin) {
            return true;
        }
        
        // Group Admin can only delete documents from their group
        if (user.getRole() == MemberRole.GroupAdmin && 
            user.getGroup() != null && 
            document.getGroup() != null &&
            user.getGroup().getId().equals(document.getGroup().getId())) {
            return true;
        }
        
        // Regular members cannot delete documents
        return false;
    }

    // KEEP EXISTING METHODS FOR BACKWARD COMPATIBILITY
    public Document saveDocument(MultipartFile file, String fileName, String documentType, 
                               String groupId, String memberId) {
        try {
            Document document = new Document();
            
            String actualFileName = fileName != null ? fileName : file.getOriginalFilename();
            document.setFileName(actualFileName);
            document.setDocumentType(documentType != null ? documentType : getFileType(actualFileName));
            String filePath = saveFileToStorage(file);
            document.setFilePathUrl(filePath);
            document.setUploadDate(java.sql.Timestamp.valueOf(LocalDateTime.now()));
            
            Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Group not found with id: " + groupId));
            Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found with id: " + memberId));
            
            document.setGroup(group);
            document.setUploadedBy(member);
            document.setCreatedBy("system");
            document.setModifiedBy("system");
            
            return documentRepository.save(document);
            
        } catch (Exception e) {
            throw new RuntimeException("Failed to save document: " + e.getMessage(), e);
        }
    }

    private String getFileType(String filename) {
        if (filename == null) return "Unknown";
        String lowerFilename = filename.toLowerCase();
        
        if (lowerFilename.endsWith(".pdf")) return "PDF";
        if (lowerFilename.endsWith(".doc") || lowerFilename.endsWith(".docx")) return "Word";
        if (lowerFilename.endsWith(".xls") || lowerFilename.endsWith(".xlsx")) return "Excel";
        if (lowerFilename.endsWith(".jpg") || lowerFilename.endsWith(".jpeg")) return "Image";
        if (lowerFilename.endsWith(".png")) return "Image";
        if (lowerFilename.endsWith(".gif")) return "Image";
        if (lowerFilename.endsWith(".txt")) return "Text";
        
        return "Other";
    }

    private String saveFileToStorage(MultipartFile file) {
    try {
        // 1. Define upload directory
        String uploadDir = "uploads/";
        java.io.File directory = new java.io.File(uploadDir);
        
        // 2. Create directory if it doesn't exist
        if (!directory.exists()) {
            boolean created = directory.mkdirs();
            System.out.println("📁 Uploads directory created: " + created);
        }
        
        // 3. Generate unique filename
        String originalFileName = file.getOriginalFilename();
        String uniqueFileName = System.currentTimeMillis() + "_" + originalFileName;
        
        // 4. Actually save the file
        java.nio.file.Path filePath = java.nio.file.Paths.get(uploadDir + uniqueFileName);
        java.nio.file.Files.copy(file.getInputStream(), filePath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        
        // 5. Log success
        System.out.println("✅ File saved to: " + filePath.toAbsolutePath());
        System.out.println("✅ File size: " + file.getSize() + " bytes");
        
        return "/uploads/" + uniqueFileName;
        
    } catch (Exception e) {
        System.out.println("❌ Error saving file: " + e.getMessage());
        throw new RuntimeException("Failed to store file: " + e.getMessage(), e);
    }
}
}

