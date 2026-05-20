'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import {
  BookOpen,
  Users,
  TrendingUp,
  Shield,
  Clock,
  CheckCircle2,
} from "lucide-react";

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      // Redirect based on role
      if (user.role === 'teacher') {
        router.push('/teacher/dashboard');
      } else {
        router.push('/student/dashboard');
      }
    }
  }, [user, isLoading, router]);

  // Show loading or redirecting state
  if (isLoading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
            <span className="text-primary-foreground font-bold text-2xl">Q</span>
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">Q</span>
            </div>
            <span className="font-semibold text-xl">QuizApp</span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground">
              How It Works
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Button variant="outline" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/login">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main>
        <section className="max-w-7xl mx-auto px-6 py-24 text-center">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
              Modern Online Examination
              <span className="text-primary"> Platform</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-10">
              Create, manage, and take exams with ease. A comprehensive solution for teachers
              and students in the digital age.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="gap-2" asChild>
                <Link href="/teacher/dashboard">
                  <BookOpen className="w-5 h-5" />
                  For Teachers
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="gap-2" asChild>
                <Link href="/student/dashboard">
                  <Users className="w-5 h-5" />
                  For Students
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="max-w-7xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Powerful Features</h2>
            <p className="text-muted-foreground text-lg">
              Everything you need to create and manage online assessments
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
                  <BookOpen className="w-6 h-6 text-blue-500" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Question Bank</h3>
                <p className="text-muted-foreground">
                  Create and organize questions in customizable banks. Support for multiple question types.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4">
                  <TrendingUp className="w-6 h-6 text-purple-500" />
                </div>
                <h3 className="font-semibold text-lg mb-2">AI Question Parser</h3>
                <p className="text-muted-foreground">
                  Convert existing questions into structured format using our AI-powered parser.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-green-500" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Secure Exam Interface</h3>
                <p className="text-muted-foreground">
                  Full-screen mode, tab-switch detection, and timed exams for secure assessments.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center mb-4">
                  <Clock className="w-6 h-6 text-orange-500" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Real-time Analytics</h3>
                <p className="text-muted-foreground">
                  Track student performance with detailed analytics and insights.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-6 h-6 text-cyan-500" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Auto Grading</h3>
                <p className="text-muted-foreground">
                  Automatic grading for objective questions. Manual review for detailed feedback.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-pink-500" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Classroom Management</h3>
                <p className="text-muted-foreground">
                  Manage students, track progress, and monitor exam sessions in real-time.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="max-w-7xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground text-lg">
              Get started in minutes with our simple workflow
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-primary-foreground">
                1
              </div>
              <h3 className="font-semibold text-xl mb-2">Create Questions</h3>
              <p className="text-muted-foreground">
                Build your question bank or use AI to import existing questions
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-primary-foreground">
                2
              </div>
              <h3 className="font-semibold text-xl mb-2">Build Exams</h3>
              <p className="text-muted-foreground">
                Assemble questions into exams with customizable settings
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-primary-foreground">
                3
              </div>
              <h3 className="font-semibold text-xl mb-2">Analyze Results</h3>
              <p className="text-muted-foreground">
                Review performance and get detailed insights
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">Q</span>
              </div>
              <span className="font-semibold">QuizApp</span>
            </div>

            <p className="text-sm text-muted-foreground">
              © 2024 QuizApp. Built with Next.js and Golang Fiber.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
