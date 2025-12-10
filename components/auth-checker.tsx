"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * AuthChecker - Validates token on mount and redirects if expired
 * This runs on every dashboard page load to catch expired tokens
 */
export function AuthChecker() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("auth_token");

      if (!token) {
        // No token, redirect to login
        router.push("/login");
        return;
      }

      // Make a lightweight API call to verify token validity
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/auth-verify`,
          {
            headers: {
              "Authorization": `Bearer ${token}`,
              "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          // Token is invalid or expired
          console.warn("🔒 Token validation failed, logging out...");
          localStorage.removeItem("auth_token");
          localStorage.removeItem("current_user");
          router.push("/login");
        }
      } catch (error) {
        console.error("Error validating token:", error);
        // On network error, don't logout (might be temporary)
      }
    };

    checkAuth();
  }, [router]);

  return null; // This component doesn't render anything
}
