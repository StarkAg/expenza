'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '../providers';

export function useProfile() {
  const { supabase, user } = useSupabase();
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setUsername(null);
      setLoading(false);
      return;
    }

    const loadProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setUsername(data?.username || null);
      } catch (error) {
        console.error('Error loading profile:', error);
        setUsername(null);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();

    // Subscribe to profile changes
    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        () => {
          loadProfile();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase]);

  return { username, loading };
}

