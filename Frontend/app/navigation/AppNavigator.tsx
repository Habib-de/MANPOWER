import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { View } from 'react-native'; // Import View for placeholder screens (only if still using them)

// Import dashboard screens for different roles
import MemberDashboardScreen from '../screens/Member/MemberDashboardScreen';
// Corrected import path: assuming 'Admin' folder is capitalized
import AdminDashboardScreen from '../screens/superAdmin/AdminDashboardScreen'; // PATH CORRECTED
import GroupDashboardScreen from '../screens/GroupAdmin/GroupAdminDashboardScreen';

// ⬇️ Import member-specific screens
import MyContributionsScreen from '../screens/Member/MyContributionsScreen';
import MeetingsScreen from '../screens/Member/MeetingsScreen';
import DocumentsScreen from '../screens/Member/DocumentsScreen';
import NotificationsScreen from '../screens/Member/NotificationsScreen';
import SettingsScreen from '../screens/Member/SettingsScreen';
import MemberProfileScreen from '../screens/Member/ProfileScreen'; // Placeholder for Member's profile

// ⬇️ Import Admin (SuperAdmin) specific screens (actual components - assuming created)
import ManageMembersScreen from '../screens/superAdmin/ManageMembersScreen'; // PATH CORRECTED
import FinancialManagementScreen from '../screens/superAdmin/FinancialManagementScreen'; // PATH CORRECTED
import MeetingManagementScreen from '../screens/superAdmin/MeetingManagementScreen';   // PATH CORRECTED
import DocumentManagementScreen from '../screens/shared/DocumentManagementScreen'; // PATH CORRECTED
import AddMemberScreen from '../screens/superAdmin/AddMemberScreen';                   // PATH CORRECTED
import RecordContributionScreen from '../screens/superAdmin/RecordContributionScreen'; // PATH CORRECTED
import ScheduleNewMeetingScreen from '../screens/superAdmin/ScheduleNewMeetingScreen'; // PATH CORRECTED
import AdminProfileScreen from '../screens/superAdmin/AdminProfileScreen'; // PATH CORRECTED
import AdminSettingsScreen from '../screens/superAdmin/AdminSettingsScreen'; // PATH CORRECTED

// ⬇️ Import Group Admin-specific screens (actual components - assuming created)
import CreateGroupScreen from '../screens/GroupAdmin/CreateGroupScreen';
import ManageGroupsScreen from '../screens/GroupAdmin/ManageGroupsScreen';
import GroupMembersScreen from '../screens/GroupAdmin/GroupMembersScreen';
import GroupContributionsScreen from '../screens/GroupAdmin/GroupContributionsScreen';
import GroupAdminProfileScreen from '../screens/GroupAdmin/GroupAdminProfileScreen';
import GroupAdminSettingsScreen from '../screens/GroupAdmin/GroupAdminSettingsScreen';


// Define parameter lists for each nested stack
type MemberStackParamList = {
  MemberDashboard: undefined;
  MyContributions: undefined;
  Meetings: undefined;
  Documents: undefined;
  Notifications: undefined;
  Settings: undefined;
  Profile: undefined; // Add Member profile screen
};

type AdminStackParamList = { // This is for SuperAdmin
  AdminDashboard: undefined;
  MemberManagement: undefined;
  FinancialManagement: undefined;
  MeetingManagement: undefined;
  DocumentManagement: undefined;
  AddMember: undefined;
  RecordContribution: undefined;
  ScheduleNewMeeting: undefined;
  AdminProfile: undefined;
  AdminSettings: undefined;
};

type GroupAdminStackParamList = {
  GroupDashboard: undefined;
  CreateGroup: undefined;
  ManageGroups: undefined;
  GroupMembers: undefined;
  GroupContributions: undefined;
  GroupAdminProfile: undefined;
  GroupAdminSettings: undefined;
};

// Define the parameter list for the main application stack
// This stack will contain all the top-level navigators based on roles.
type AppStackParamList = {
  MemberStack: undefined; // Nested navigator for members
  AdminStack: undefined;  // Nested navigator for SuperAdmins
  GroupAdminStack: undefined; // Nested navigator for Group Admins
};

const AppStack = createStackNavigator<AppStackParamList>();
const MemberStack = createStackNavigator<MemberStackParamList>();
const AdminStack = createStackNavigator<AdminStackParamList>(); // For SuperAdmin
const GroupAdminStack = createStackNavigator<GroupAdminStackParamList>();

// AppNavigator expects userRole in camelCase, consistent with index.tsx
interface AppNavigatorProps {
  userRole: 'Member' | 'SuperAdmin' | 'GroupAdmin';
}

// Nested Navigator for Member Role
function MemberNavigator() {
  return (
    <MemberStack.Navigator screenOptions={{ headerShown: false }}>
      <MemberStack.Screen name="MemberDashboard" component={MemberDashboardScreen} />
      <MemberStack.Screen name="MyContributions" component={MyContributionsScreen} />
      <MemberStack.Screen name="Meetings" component={MeetingsScreen} />
      <MemberStack.Screen name="Documents" component={DocumentsScreen} />
      <MemberStack.Screen name="Notifications" component={NotificationsScreen} />
      <MemberStack.Screen name="Settings" component={SettingsScreen} />
      <MemberStack.Screen name="Profile" component={MemberProfileScreen} />
      {/* Add more member-specific screens as needed */}
    </MemberStack.Navigator>
  );
}

// Nested Navigator for Admin (SuperAdmin) Role
function AdminNavigator() {
  return (
    <AdminStack.Navigator screenOptions={{ headerShown: false }}>
      <AdminStack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      {/* Main navigation categories for SuperAdmin */}
      <AdminStack.Screen name="MemberManagement" component={ManageMembersScreen} />
      <AdminStack.Screen name="FinancialManagement" component={FinancialManagementScreen} />
      <AdminStack.Screen name="MeetingManagement" component={MeetingManagementScreen} />
      <AdminStack.Screen name="DocumentManagement" component={DocumentManagementScreen} />
      {/* Quick links / Specific actions for SuperAdmin */}
      <AdminStack.Screen name="AddMember" component={AddMemberScreen} />
      <AdminStack.Screen name="RecordContribution" component={RecordContributionScreen} />
      <AdminStack.Screen name="ScheduleNewMeeting" component={ScheduleNewMeetingScreen} />
      {/* Profile & Settings for SuperAdmin */}
      <AdminStack.Screen name="AdminProfile" component={AdminProfileScreen} />
      <AdminStack.Screen name="AdminSettings" component={AdminSettingsScreen} />
      {/* Add more SuperAdmin specific screens as needed */}
    </AdminStack.Navigator>
  );
}

// Nested Navigator for Group Admin Role
function GroupAdminNavigator() {
  return (
    <GroupAdminStack.Navigator screenOptions={{ headerShown: false }}>
      <GroupAdminStack.Screen name="GroupDashboard" component={GroupDashboardScreen} />
      <GroupAdminStack.Screen name="CreateGroup" component={CreateGroupScreen} />
      <GroupAdminStack.Screen name="ManageGroups" component={ManageGroupsScreen} />
      <GroupAdminStack.Screen name="GroupMembers" component={GroupMembersScreen} />
      <GroupAdminStack.Screen name="GroupContributions" component={GroupContributionsScreen} />
      <GroupAdminStack.Screen name="GroupAdminProfile" component={GroupAdminProfileScreen} />
      <GroupAdminStack.Screen name="GroupAdminSettings" component={GroupAdminSettingsScreen} />
      {/* Add more Group Admin specific screens as needed */}
    </GroupAdminStack.Navigator>
  );
}


function AppNavigator({ userRole }: AppNavigatorProps): React.JSX.Element {
  // Determine which nested navigator to render based on userRole
  const getInitialNavigator = () => {
    switch (userRole) {
      case 'SuperAdmin':
        return 'AdminStack'; // Render the Admin's (SuperAdmin's) nested stack
      case 'GroupAdmin':
        return 'GroupAdminStack'; // Render the Group Admin's nested stack
      case 'Member':
        return 'MemberStack'; // Render the Member's nested stack
      default:
        console.warn("Unknown user role, defaulting to MemberStack.");
        return 'MemberStack';
    }
  };

  return (
    <AppStack.Navigator screenOptions={{ headerShown: false }} initialRouteName={getInitialNavigator()}>
      {/* Define the top-level screens, which are now the nested navigators */}
      <AppStack.Screen name="MemberStack" component={MemberNavigator} />
      <AppStack.Screen name="AdminStack" component={AdminNavigator} />
      <AppStack.Screen name="GroupAdminStack" component={GroupAdminNavigator} />
    </AppStack.Navigator>
  );
}

export default AppNavigator;
