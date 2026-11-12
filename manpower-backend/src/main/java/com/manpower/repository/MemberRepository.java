package com.manpower.repository;

import com.manpower.entity.Member;
import com.manpower.enums.MemberRole;
import com.manpower.enums.MemberStatus;  // ✅ ADD THIS IMPORT
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List; // ✅ Import List

@Repository
public interface MemberRepository extends JpaRepository<Member, String> {
    Optional<Member> findByEmail(String email);
    Optional<Member> findByRole(MemberRole role);

    // ✅ Add this line to support fetching members by groupId
    List<Member> findByGroupId(String groupId);

    // ✅ NEW: ADD THIS METHOD RIGHT HERE (after findByGroupId)
    List<Member> findByGroupIdAndStatus(String groupId, MemberStatus status);

      // ✅ ADD THIS LINE RIGHT HERE (as the 4th method):
    Optional<Member> findByPhoneNumberContaining(String phoneNumber);
}
