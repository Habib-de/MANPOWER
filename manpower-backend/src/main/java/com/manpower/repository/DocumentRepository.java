package com.manpower.repository;

import com.manpower.entity.Document;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DocumentRepository extends JpaRepository<Document, String> {
    
    // Find all documents by group ID
    List<Document> findByGroupId(String groupId);
    
    // Alternative: Custom query with JOIN FETCH to avoid N+1 problem
    @Query("SELECT d FROM Document d JOIN FETCH d.group JOIN FETCH d.uploadedBy WHERE d.group.id = :groupId")
    List<Document> findByGroupIdWithDetails(@Param("groupId") String groupId);
    
    // Find documents by group ID and document type
    List<Document> findByGroupIdAndDocumentType(String groupId, String documentType);
    
    // Count documents in a group
    long countByGroupId(String groupId);
    
    // Find documents by uploaded user's ID
    List<Document> findByUploadedById(String memberId);
    
    // Find documents by group ID, ordered by upload date (newest first)
    List<Document> findByGroupIdOrderByUploadDateDesc(String groupId);
    
    // Custom query to find documents with search in filename
    @Query("SELECT d FROM Document d WHERE d.group.id = :groupId AND LOWER(d.fileName) LIKE LOWER(CONCAT('%', :searchTerm, '%'))")
    List<Document> findByGroupIdAndFileNameContaining(@Param("groupId") String groupId, @Param("searchTerm") String searchTerm);
}