package com.manpower.controller;

import com.manpower.entity.Document;
import com.manpower.entity.Member;
import com.manpower.enums.MemberRole;
import com.manpower.service.DocumentService;
import com.manpower.repository.MemberRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Optional;

@CrossOrigin(origins = {"http://localhost:8081", "http://192.168.0.101:8081"})
@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    @Autowired
    private DocumentService documentService;

    @Autowired
    private MemberRepository memberRepository;

    // GET ALL DOCUMENTS WITH ROLE-BASED FILTERING
    @GetMapping
    public ResponseEntity<?> getAllDocuments(@RequestParam String userEmail) {
        try {
            Member currentUser = memberRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));
            
            List<Document> documents;
            
            if (currentUser.getRole() == MemberRole.SuperAdmin) {
                // Super Admin sees all documents
                documents = documentService.getAllDocuments();
            } else {
                // Group Admin and Members see only their group's documents
                documents = documentService.getDocumentsByUserGroup(userEmail);
            }
            
            return ResponseEntity.ok(documents);
            
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Error fetching documents: " + e.getMessage());
        }
    }

    // GET DOCUMENTS FOR CURRENT USER'S GROUP ONLY
    @GetMapping("/my-group")
    public ResponseEntity<?> getMyGroupDocuments(@RequestParam String userEmail) {
        try {
            List<Document> documents = documentService.getDocumentsByUserGroup(userEmail);
            return ResponseEntity.ok(documents);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Error fetching group documents: " + e.getMessage());
        }
    }

    // UPLOAD DOCUMENT WITH USER'S GROUP AUTOMATICALLY
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadDocument(
            @RequestPart("file") MultipartFile file,
            @RequestParam String userEmail,
            @RequestParam(value = "fileName", required = false) String fileName,
            @RequestParam(value = "documentType", required = false) String documentType) {
        
        try {
            Document uploadedDocument = documentService.saveDocumentForUser(
                file, fileName, documentType, userEmail);
            return ResponseEntity.ok(uploadedDocument);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body("Upload failed: " + e.getMessage());
        }
    }

    // DELETE DOCUMENT WITH PERMISSION CHECK
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteDocument(@PathVariable String id, @RequestParam String userEmail) {
        try {
            memberRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));
            
            boolean canDelete = documentService.canUserDeleteDocument(id, userEmail);
            
            if (canDelete) {
                documentService.deleteDocument(id);
                return ResponseEntity.ok().build();
            } else {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Not authorized to delete this document");
            }
            
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Error deleting document: " + e.getMessage());
        }
    }

    // KEEP EXISTING METHODS FOR BACKWARD COMPATIBILITY
    @GetMapping("/{id}")
    public ResponseEntity<?> getDocumentById(@PathVariable String id) {
        try {
            Optional<Document> document = documentService.getDocumentById(id);
            return document.map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Error fetching document: " + e.getMessage());
        }
    }

    @PostMapping("/create")
    public Document createDocument(@RequestBody Document document) {
        return documentService.saveDocument(document);
    }
}