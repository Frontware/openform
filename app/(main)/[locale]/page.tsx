import { AuthMessage } from '@/components/auth/auth-message'
import { TokenHandler } from '@/components/auth/token-handler'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'
import { ArrowRight, Palette, Shield, Sparkles, Zap } from 'lucide-react'
import Link from 'next/link'

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      <TokenHandler />
      <AuthMessage />
      {/* Sophisticated Yellow Gradient Background */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background: "linear-gradient(#fdcc52, #fdc539)",
        }}
      />
      
      {/* Subtle grid pattern */}
      <div 
        className="absolute inset-0 z-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2313a89e' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div 
          className="absolute inset-0 h-28 backdrop-blur-md"
          style={{
            maskImage: 'linear-gradient(to bottom, black 0%, black 75%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 75%, transparent 100%)',
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.92) 70%, rgba(255,255,255,0) 100%)',
          }}
        />
        <div className="relative max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <Logo href="/" />
          <div className="flex items-center gap-4">
            <Link href={`/${locale}/dashboard`}>
              <Button className="bg-[#13a89e] hover:bg-[#0f8a82] shadow-lg shadow-[#13a89e]/20 transition-all hover:shadow-[#13a89e]/30 hover:-translate-y-0.5">
                Dashboard
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-50 text-[#13a89e] text-sm font-medium mb-8 border border-teal-100">
            <Sparkles className="w-4 h-4" />
            Weladee: Your HRMS Solution
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-slate-900 leading-tight mb-6 tracking-tight">
            Forms that feel{' '}
            <span className="text-[#13a89e]">
              human
            </span>
          </h1>
          
          <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Create beautiful, engaging forms that people actually want to fill out. 
            One question at a time, just like a conversation.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href={`/${locale}/dashboard`}>
              <Button size="lg" className="h-14 px-8 text-lg bg-[#13a89e] hover:bg-[#0f8a82] shadow-xl shadow-[#13a89e]/25 transition-all hover:shadow-[#13a89e]/35 hover:-translate-y-0.5">
                Start creating
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="#features">
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-slate-300 hover:border-slate-400 hover:bg-slate-50">
                See how it works
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Demo Preview */}
      <section className="relative z-10 px-6 pb-20">
        <div className="max-w-5xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-blue-900/10 border border-slate-200/80 bg-white">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-100 border-b border-slate-200">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                <div className="w-3 h-3 rounded-full bg-slate-300"></div>
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 bg-white rounded-md text-xs text-slate-500 font-medium">
                  forms.weladee.com/your-form
                </div>
              </div>
            </div>
            <div className="aspect-video bg-gradient-to-br from-[#13a89e] via-[#16c2b1] to-teal-400 flex items-center justify-center relative overflow-hidden">
              {/* Decorative circles */}
              <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-400/10 rounded-full blur-3xl"></div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 max-w-lg text-center border border-white/20">
                <h3 className="text-3xl font-bold text-white mb-4">What&apos;s your name?</h3>
                <div className="bg-white/20 rounded-lg h-14 flex items-center px-4 border border-white/10">
                  <span className="text-white/60 text-lg">Type your answer here...</span>
                </div>
                <div className="mt-6 flex items-center justify-center gap-3">
                  <span className="text-white/60 text-sm">Press</span>
                  <kbd className="px-3 py-1 bg-white/20 rounded text-white text-sm font-medium border border-white/10">Enter ↵</kbd>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 tracking-tight">
              Everything you need to create amazing forms
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Powerful features that make form building a breeze
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-teal-50 to-white border border-teal-100/60 hover:shadow-lg hover:shadow-teal-100/50 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-[#13a89e]" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">One at a Time</h3>
              <p className="text-slate-600">
                Questions appear one by one, creating a focused, distraction-free experience for respondents.
              </p>
            </div>
            
            <div className="p-6 rounded-2xl bg-gradient-to-br from-sky-50 to-white border border-sky-100/60 hover:shadow-lg hover:shadow-sky-100/50 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-sky-100 flex items-center justify-center mb-4">
                <Palette className="w-6 h-6 text-[#13a89e]" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Beautiful Themes</h3>
              <p className="text-slate-600">
                Choose from stunning preset themes that make your forms look professional and on-brand.
              </p>
            </div>
            
            <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-100/60 hover:shadow-lg hover:shadow-emerald-100/50 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Privacy First</h3>
              <p className="text-slate-600">
                Your data stays yours. Export responses anytime, delete when you want.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Question Types */}
      <section className="relative z-10 py-20 px-6 bg-slate-50/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 tracking-tight">
              13 question types to choose from
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              From simple text to file uploads, we&apos;ve got you covered
            </p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-3">
            {[
              'Short Text', 'Long Text', 'Dropdown', 'Checkboxes',
              'Email', 'Phone', 'Number', 'Date', 'Rating', 'Opinion Scale',
              'Yes/No', 'File Upload', 'Website URL'
            ].map((type) => (
              <span
                key={type}
                className="px-4 py-2 bg-white rounded-full border border-slate-200 text-slate-700 text-sm font-medium shadow-sm hover:border-teal-200 hover:bg-teal-50 transition-colors cursor-default"
              >
                {type}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-br from-[#13a89e] via-[#16c2b1] to-teal-400 rounded-3xl p-12 md:p-16 text-white relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
            
            <h2 className="text-3xl md:text-4xl font-bold mb-4 relative">
              Ready to create your first form?
            </h2>
            <p className="text-lg text-blue-100 mb-8 relative">
              Join thousands of people using Weladee Form to collect responses.
            </p>
            <Link href={`/${locale}/dashboard`}>
              <Button size="lg" className="h-14 px-8 text-lg bg-white text-[#13a89e] hover:bg-teal-50 shadow-xl shadow-teal-900/20 relative transition-all hover:-translate-y-0.5">
                Go to dashboard
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-8 px-6 border-t border-slate-100 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-600 text-sm">
            © 2026 Weladee Form. 
          </p>
          <div className="flex items-center gap-6">
            <a href="https://github.com" className="text-slate-500 hover:text-slate-700 text-sm transition-colors">
              GitHub
            </a>
            <a href="#" className="text-slate-500 hover:text-slate-700 text-sm transition-colors">
              Privacy
            </a>
            <a href="#" className="text-slate-500 hover:text-slate-700 text-sm transition-colors">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
