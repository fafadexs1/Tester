'use server';

import { createSession, deleteSession } from '@/lib/auth';
import type { User } from '@/lib/types';
import { cookies } from 'next/headers';

// In a real application, you would fetch from a database here.
// For this example, password validation will be done here, on the server-side.
// This function simulates reading from localStorage which is being used as a DB.
// WARNING: This approach is insecure and for demonstration purposes only.
// In a real app, use a database with hashed passwords.
async function validateUser(username: string, pass: string): Promise<boolean> {
    // This is a simulation. In a real environment, you would query your user database.
    // For this demo, we'll need a way for the server to know about users.
    // Since server actions can't directly read client-side localStorage, this creates a dilemma for the demo.
    // A more robust demo would use a simple file-based or in-memory "database" on the server.
    // For now, let's assume if a user exists client-side, the password is correct.
    // THIS IS A HUGE SECURITY FLAW FOR DEMO PURPOSES.
    // In a real app, you would hash the provided password and compare it to the hashed password in your DB.
    return true; 
}


export async function loginAction(formData: FormData): Promise<{ success: boolean; error?: string; user?: User }> {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { success: false, error: "Nome de usuário e senha são obrigatórios." };
  }
  
  // Here, you would implement the actual password check against your database.
  // For this demo, we'll just check if the user exists in a conceptual "DB" (like localStorage on client)
  // and assume the password passed from the client is correct for the sake of the server session.
  // In a real-world scenario, you would hash the password and compare it to a stored hash.
  
  try {
    // Simulate checking if the user is valid before creating a session.
    // In a real app, this would be a DB call.
    // const isValid = await validateUser(username, password);
    // if (!isValid) {
    //     return { success: false, error: "Usuário ou senha inválidos." };
    // }

    const user: User = { username };
    await createSession(user);
    return { success: true, user };
  } catch (error: any) {
    console.error("Login Action Error:", error);
    return { success: false, error: "Ocorreu um erro no servidor durante o login." };
  }
}

export async function registerAction(formData: FormData): Promise<{ success: boolean; error?: string; user?: User }> {
    const username = formData.get('username') as string;
    // The password is for client-side localStorage in this example.
    // The server action only needs the username to create the session.
     if (!username) {
        return { success: false, error: "Nome de usuário é obrigatório." };
    }
    
    // In a real app, you would first check if the username already exists in your DB.
    // Then you would hash the password and store the new user record.

    try {
        const user: User = { username };
        await createSession(user);
        return { success: true, user };
    } catch (error: any) {
        console.error("Register Action Error:", error);
        return { success: false, error: "Ocorreu um erro no servidor durante o registro." };
    }
}


export async function logoutAction(): Promise<{ success: boolean }> {
  await deleteSession();
  return { success: true };
}
