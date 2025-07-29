
'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Zap } from 'lucide-react';

export default function LoginPage() {
  const [isLoginView, setIsLoginView] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const router = useRouter();
  const { user, login, register } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (isLoginView) {
      // Handle Login
      try {
        login(username, password);
        toast({ title: "Login bem-sucedido!", description: `Bem-vindo de volta, ${username}!` });
        router.push('/');
      } catch (error: any) {
        toast({
          title: "Erro no Login",
          description: error.message || "Usuário ou senha inválidos.",
          variant: "destructive",
        });
      }
    } else {
      // Handle Register
      if (password !== confirmPassword) {
        toast({ title: "Erro de Registro", description: "As senhas não coincidem.", variant: "destructive" });
        return;
      }
      try {
        register(username, password);
        toast({ title: "Registro bem-sucedido!", description: `Bem-vindo, ${username}! Você agora está logado.` });
        router.push('/');
      } catch (error: any) {
        toast({
          title: "Erro no Registro",
          description: error.message || "Não foi possível registrar o usuário.",
          variant: "destructive",
        });
      }
    }
  };

  if (user) {
      return null;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40" suppressHydrationWarning={true}>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
            <div className="flex justify-center items-center gap-2 mb-2">
                <Zap className="w-8 h-8 text-primary" />
                <CardTitle className="text-2xl">NexusFlow</CardTitle>
            </div>
          <CardDescription>
            {isLoginView ? 'Entre com sua conta para continuar' : 'Crie uma nova conta para começar'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                type="text"
                placeholder="seu-usuario"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {!isLoginView && (
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar Senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full">
              {isLoginView ? 'Entrar' : 'Registrar'}
            </Button>
            <Button variant="link" type="button" onClick={() => setIsLoginView(!isLoginView)}>
              {isLoginView ? 'Não tem uma conta? Registre-se' : 'Já tem uma conta? Faça o login'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
