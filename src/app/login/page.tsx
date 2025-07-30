'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Zap, BotMessageSquare, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const [isLoginView, setIsLoginView] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { user, login, register, loading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);
  
  if (loading || user) {
      return (
         <div className="flex h-screen w-full items-center justify-center bg-background">
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            >
                <Zap className="h-12 w-12 text-primary" />
            </motion.div>
        </div>
      );
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    let result;
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    if (isLoginView) {
      result = await login(formData, password); // Pass password for client-side validation
      if (result.success) {
        toast({ title: "Login bem-sucedido!", description: `Bem-vindo de volta, ${username}!` });
        // Redirect is handled by the useEffect
      } else {
        toast({
          title: "Erro no Login",
          description: result.error || "Usuário ou senha inválidos.",
          variant: "destructive",
        });
      }
    } else {
      if (password !== confirmPassword) {
        toast({ title: "Erro de Registro", description: "As senhas não coincidem.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
      result = await register(formData, password); // Pass password for client-side storage
      if (result.success) {
        toast({ title: "Registro bem-sucedido!", description: `Bem-vindo, ${username}! Você agora está logado.` });
         // Redirect is handled by the useEffect
      } else {
        toast({
          title: "Erro no Registro",
          description: result.error || "Não foi possível registrar o usuário.",
          variant: "destructive",
        });
      }
    }
    
    // Only set submitting to false on error, as success will trigger a redirect.
    if (!result.success) {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4 relative overflow-hidden">
       <div className="absolute top-0 left-0 -translate-x-1/3 -translate-y-1/3 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
       <div className="absolute bottom-0 right-0 translate-x-1/3 translate-y-1/3 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse delay-500"></div>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="z-10"
      >
        <Card className="w-full max-w-sm border-border/60 bg-card/80 backdrop-blur-sm shadow-2xl">
          <CardHeader className="text-center">
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
                className="flex justify-center items-center gap-3 mb-2"
              >
                  <Zap className="w-9 h-9 text-primary" />
                  <h1 className="text-3xl font-bold tracking-tighter text-foreground">NexusFlow</h1>
              </motion.div>
            <CardDescription>
              {isLoginView ? 'Entre na sua conta para criar o futuro' : 'Crie uma conta para começar a automação'}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Usuário</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="seu-usuario"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-input/80"
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-input/80"
                  disabled={isSubmitting}
                />
              </div>
              {!isLoginView && (
                <motion.div
                    className="space-y-2"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.3 }}
                >
                  <Label htmlFor="confirm-password">Confirmar Senha</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-input/80"
                    disabled={isSubmitting}
                  />
                </motion.div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-4 pt-2">
              <Button type="submit" className="w-full font-semibold" disabled={isSubmitting}>
                 {isSubmitting ? <Loader2 className="animate-spin" /> : (isLoginView ? 'Entrar' : 'Registrar')}
              </Button>
              <Button variant="link" type="button" onClick={() => setIsLoginView(!isLoginView)} className="text-muted-foreground" disabled={isSubmitting}>
                {isLoginView ? 'Não tem uma conta? Registre-se' : 'Já tem uma conta? Faça o login'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
