package com.manpower.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.manpower.enums.MemberRole;
import com.manpower.enums.MemberStatus;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.GenericGenerator;
import org.hibernate.annotations.UpdateTimestamp;

import javax.persistence.*;
import javax.validation.constraints.*;
import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;

@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"}) // ✅ Avoid proxy issues
@Entity
@Table(name = "members")
public class Member implements Serializable {

    @Id
    @GeneratedValue(generator = "uuid2")
    @GenericGenerator(name = "uuid2", strategy = "org.hibernate.id.UUIDGenerator")
    @Column(name = "id", length = 40)
    private String id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "group_id", referencedColumnName = "id")
    @JsonBackReference
    private Group group;

    @NotBlank(message = "First name cannot be empty")
    @Size(max = 100)
    @Column(name = "firstName", length = 100)
    private String firstName;

    @NotBlank(message = "Last name cannot be empty")
    @Size(max = 100)
    @Column(name = "lastName", length = 100)
    private String lastName;

    @NotBlank(message = "Email cannot be empty")
    @Email
    @Size(max = 150)
    @Column(name = "email", length = 150, unique = true)
    private String email;

    @NotBlank(message = "Phone number cannot be empty")
    @Size(max = 20)
    @Pattern(regexp = "^(\\+254|0)\\d{9}$", message = "Phone number must be a valid Kenyan format (+254XXXXXXXXX or 07XXXXXXXX)")
    @Column(name = "phoneNumber", length = 20)
    private String phoneNumber;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY) // ✅ Allow write but hide from responses
    @NotBlank(message = "Password cannot be empty")
    @Size(min = 8, max = 255)
    @Column(name = "password", length = 255)
    private String password;

    @CreationTimestamp
    @PastOrPresent(message = "Join date cannot be in the future")
    @Column(name = "joinDate", updatable = false)
    private LocalDate joinDate;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20)
    private MemberStatus status = MemberStatus.Active;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private MemberRole role;

    @NotBlank
    @Size(max = 40)
    @Column(name = "created_by", length = 40)
    private String createdBy;

    @NotBlank
    @Size(max = 40)
    @Column(name = "modified_by", length = 40)
    private String modifiedBy;

    @CreationTimestamp
    @Column(name = "created_on", updatable = false)
    private LocalDateTime createdOn;

    @UpdateTimestamp
    @Column(name = "modified_on")
    private LocalDateTime modifiedOn;

    @NotBlank
    @Size(max = 100)
    @Column(name = "mansoft_tenant_id", length = 100)
    private String mansoftTenantId;

    // === Getters and Setters ===

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Group getGroup() { return group; }
    public void setGroup(Group group) { this.group = group; }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public LocalDate getJoinDate() { return joinDate; }
    public void setJoinDate(LocalDate joinDate) { this.joinDate = joinDate; }

    public MemberStatus getStatus() { return status; }
    public void setStatus(MemberStatus status) { this.status = status; }

    public MemberRole getRole() { return role; }
    public void setRole(MemberRole role) { this.role = role; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public String getModifiedBy() { return modifiedBy; }
    public void setModifiedBy(String modifiedBy) { this.modifiedBy = modifiedBy; }

    public LocalDateTime getCreatedOn() { return createdOn; }
    public void setCreatedOn(LocalDateTime createdOn) { this.createdOn = createdOn; }

    public LocalDateTime getModifiedOn() { return modifiedOn; }
    public void setModifiedOn(LocalDateTime modifiedOn) { this.modifiedOn = modifiedOn; }

    public String getMansoftTenantId() { return mansoftTenantId; }
    public void setMansoftTenantId(String mansoftTenantId) { this.mansoftTenantId = mansoftTenantId; }
}
