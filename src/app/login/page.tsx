'use client';

import { useState, FormEvent } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Zap, Loader2, Mail, User, KeyRound } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const [isLoginView, setIsLoginView] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, register, loading, user } = useAuth();
  const { toast } = useToast();
  
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    
    if (!isLoginView) {
      formData.append('fullName', fullName);
      formData.append('email', email);
    }

    try {
      let result;
      if (isLoginView) {
        result = await login(formData);
      } else {
        if (password !== confirmPassword) {
          toast({ title: "Erro de Registro", description: "As senhas não coincidem.", variant: "destructive" });
          setIsSubmitting(false);
          return;
        }
        result = await register(formData);
      }
      
      if (!result.success) {
        toast({
          title: isLoginView ? "Erro no Login" : "Erro no Registro",
          description: result.error || (isLoginView ? "Usuário ou senha inválidos." : "Não foi possível registrar o usuário."),
          variant: "destructive",
        });
      }
      
    } catch (error: any) {
        toast({
          title: "Erro Inesperado",
          description: error.message || "Ocorreu um erro durante a operação.",
          variant: "destructive",
        });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (loading || user) {
     return null; 
  }

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
                 <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="username"
                      name="username"
                      type="text"
                      placeholder="seu-usuario"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="bg-input/80 pl-9"
                      disabled={isSubmitting}
                    />
                </div>
              </div>
              
              {!isLoginView && (
                 <motion.div
                    className="space-y-4"
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: '1rem' }}
                    transition={{ duration: 0.3 }}
                >
                    <div className="space-y-2">
                        <Label htmlFor="fullName">Nome Completo</Label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="fullName"
                                name="fullName"
                                type="text"
                                placeholder="Seu nome completo"
                                required
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="bg-input/80 pl-9"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <div className="relative">
                           <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="seu@email.com"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="bg-input/80 pl-9"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>
                </motion.div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                 <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-input/80 pl-9"
                      disabled={isSubmitting}
                    />
                </div>
              </div>
              {!isLoginView && (
                <motion.div
                    className="space-y-2"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.3 }}
                >
                  <Label htmlFor="confirm-password">Confirmar Senha</Label>
                  <div className="relative">
                     <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        id="confirm-password"
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="bg-input/80 pl-9"
                        disabled={isSubmitting}
                    />
                  </div>
                </motion.div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-4 pt-2">
              <Button type="submit" className="w-full font-semibold" disabled={isSubmitting || loading}>
                 {isSubmitting ? <Loader2 className="animate-spin" /> : (isLoginView ? 'Entrar' : 'Registrar')}
              </Button>
              <Button variant="link" type="button" onClick={() => setIsLoginView(!isLoginView)} className="text-muted-foreground" disabled={isSubmitting || loading}>
                {isLoginView ? 'Não tem uma conta? Registre-se' : 'Já tem uma conta? Faça o login'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
