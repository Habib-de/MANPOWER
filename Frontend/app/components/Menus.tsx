// components/Menu.tsx
import React from 'react';
import { Button, StyleSheet, View } from 'react-native';

type UserRole = 'Member' | 'GroupAdmin' | 'SuperAdmin';

// IMPORTANT: Export MenuProps so CustomDrawerContent can import it
export type MenuProps = {
  userRole: UserRole;
  onNavigate: (screenName: string, params?: object) => void;
};

const Menu = ({ userRole, onNavigate }: MenuProps) => {
  return (
    <View style={styles.menu}>
      {/* Common to all roles */}
      <View style={styles.button}>
        <Button title="View Members" onPress={() => onNavigate('ViewMembersCommon', { title: "View Members (All)" })} />
      </View>

      {userRole === 'Member' && (
        <>
          <View style={styles.button}>
            <Button title="Post Contribution" onPress={() => onNavigate('PostContribution', { title: "Post New Contribution" })} />
          </View>
          <View style={styles.button}>
            <Button title="View Contributions" onPress={() => onNavigate('MyContributions')} />
          </View>
        </>
      )}

      {userRole === 'GroupAdmin' && (
        <>
          <View style={styles.button}>
            <Button title="Add Member" onPress={() => onNavigate('AddMember', { title: "Add New Member" })} />
          </View>
          <View style={styles.button}>
            <Button title="Create Group" onPress={() => onNavigate('CreateGroup')} />
          </View>
          <View style={styles.button}>
            <Button title="Manage Groups" onPress={() => onNavigate('ManageGroups')} />
          </View>
          <View style={styles.button}>
            <Button title="View Contributions" onPress={() => onNavigate('GroupContributions')} />
          </View>
        </>
      )}

      {userRole === 'SuperAdmin' && (
        <>
          <View style={styles.button}>
            <Button title="Add Member" onPress={() => onNavigate('AddMember', { title: "Add New Member" })} />
          </View>
          <View style={styles.button}>
            <Button title="Post Contribution" onPress={() => onNavigate('RecordContribution', { title: "Record New Contribution" })} />
          </View>
          <View style={styles.button}>
            <Button title="View Contributions" onPress={() => onNavigate('ViewContributions', { title: "View All Contributions (Common)" })} />
          </View>
          <View style={styles.button}>
            <Button title="Manage Groups" onPress={() => onNavigate('ManageGroups', { title: "Manage Groups (Common)" })} />
          </View>
          <View style={styles.button}>
            <Button title="View Meetings" onPress={() => onNavigate('MeetingManagement', { title: "Meeting Management" })} />
          </View>
          <View style={styles.button}>
            <Button title="View Documents" onPress={() => onNavigate('DocumentManagement', { title: "Document Management" })} />
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  menu: {
    marginTop: 20,
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 8,
  },
  button: {
    marginBottom: 12,
  },
});

export default Menu;