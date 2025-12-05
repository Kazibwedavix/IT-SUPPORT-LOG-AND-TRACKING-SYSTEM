import React from 'react';
import { useUserStats } from '../hooks/useAdmin';

const AdminTest = () => {
  const { data: stats, isLoading, error } = useUserStats();

  if (isLoading) return <div>Loading stats...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Admin API Test</h2>
      <pre>{JSON.stringify(stats, null, 2)}</pre>
    </div>
  );
};

export default AdminTest;