package com.manpower.repository;

import com.manpower.entity.DividendDeclaration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DividendDeclarationRepository extends JpaRepository<DividendDeclaration, String> {

    // Find the most recent approved declaration
    @Query("SELECT d FROM DividendDeclaration d WHERE d.status = 'APPROVED' ORDER BY d.declaredDate DESC")
    List<DividendDeclaration> findCurrentApprovedDeclarations();

    // Find latest approved declaration
    @Query("SELECT d FROM DividendDeclaration d WHERE d.status = 'APPROVED' ORDER BY d.declaredDate DESC")
    Optional<DividendDeclaration> findLatestApprovedDeclaration();

    // Find declarations by status
    List<DividendDeclaration> findByStatus(String status);

    // Find declarations by group ID
    List<DividendDeclaration> findByGroupId(String groupId);

    // ✅ ADD THIS: Find latest approved declaration by group
    @Query("SELECT d FROM DividendDeclaration d WHERE d.status = 'APPROVED' AND d.group.id = :groupId ORDER BY d.declaredDate DESC")
    Optional<DividendDeclaration> findLatestApprovedDeclarationByGroup(@Param("groupId") String groupId);

    // Find declarations by financial year
    Optional<DividendDeclaration> findByFinancialYear(String financialYear);
}