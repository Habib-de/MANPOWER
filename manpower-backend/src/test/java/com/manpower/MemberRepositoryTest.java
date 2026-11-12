package com.manpower;

import com.manpower.entity.Member;
import com.manpower.enums.MemberRole;
import com.manpower.enums.MemberStatus;
import com.manpower.repository.MemberRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
// import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID; // Import UUID for unique ID generation

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
// @Transactional // Uncomment if you want rollback after test
public class MemberRepositoryTest {

    @Autowired
    private MemberRepository memberRepository;

    @Test
    void testCreateMultipleMembers() {
        // These calls will now generate unique emails for each test run
        createAndVerifyMember("Ahmed", "Mohamed", "0712345678", MemberRole.Member, "memberpass123");
        createAndVerifyMember("Fatima", "Omar", "0798765432", MemberRole.Member, "memberpass123");
        createAndVerifyMember("Grace", "Muthoni", "0722112233", MemberRole.GroupAdmin, "groupadminpass");
    }

    private void createAndVerifyMember(String firstName, String lastName, String phoneNumber, MemberRole role, String password) {
        // Generate a unique suffix for the email to avoid DataIntegrityViolationException
        String uniqueSuffix = UUID.randomUUID().toString().substring(0, 8);
        String email = (firstName + "." + lastName + "+" + uniqueSuffix + "@example.com").toLowerCase();

        Member member = new Member();
        // Do not manually set the ID; let JPA generate it
        member.setFirstName(firstName);
        member.setLastName(lastName);
        member.setEmail(email); // Use the uniquely generated email
        member.setPhoneNumber(phoneNumber);
        member.setPassword(password);
        member.setJoinDate(LocalDate.now());
        member.setStatus(MemberStatus.Active);
        member.setRole(role);
        member.setCreatedBy("test-script");
        member.setModifiedBy("test-script");
        member.setMansoftTenantId("tenant001");

        Member saved = memberRepository.save(member);
        assertNotNull(saved);
        assertNotNull(saved.getId());

        System.out.println("✅ Member saved: " + saved.getFirstName() + " " + saved.getLastName() + " with ID: " + saved.getId() + " Role: " + saved.getRole() + " Email: " + saved.getEmail());

        Member found = memberRepository.findById(saved.getId()).orElse(null);
        assertNotNull(found);
        assertEquals(firstName, found.getFirstName());
        assertEquals(phoneNumber, found.getPhoneNumber());
        assertEquals(role, found.getRole());
        assertEquals(saved.getId(), found.getId());
        assertEquals(email, found.getEmail()); // Assert that the unique email is saved and found

        System.out.println("🔍 Found: " + found.getFirstName() + " | Email: " + found.getEmail() + " | Role: " + found.getRole());
    }
}

