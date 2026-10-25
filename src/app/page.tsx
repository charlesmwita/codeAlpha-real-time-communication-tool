import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser().catch(() => null);

  return (
    <div className="eco-page min-h-screen overflow-hidden">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" aria-label="Quorum home">
          <Logo />
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-3">
          <a href="#approach" className="hidden px-3 py-2 text-sm text-[var(--paper-dim)] transition hover:text-white sm:inline-flex">
            Our approach
          </a>
          <a href="#features" className="hidden px-3 py-2 text-sm text-[var(--paper-dim)] transition hover:text-white sm:inline-flex">
            Features
          </a>
          {user ? (
            <Link href="/dashboard" className="btn btn-lime py-2">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost py-2">
                Sign in
              </Link>
              <Link href="/register" className="btn btn-lime py-2">
                Start a room
              </Link>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:pb-24 lg:pt-16">
          <div className="relative z-10">
            <p className="stamp text-[var(--lime)]">Thoughtful collaboration, by design</p>
            <h1 className="display mt-7 max-w-xl text-6xl font-semibold leading-[0.94] sm:text-7xl">
              Good work.
              <span className="block text-[var(--lime)]">Less distance.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-[var(--paper-dim)]">
              Bring your team together from wherever they are. Quorum combines private video, a live whiteboard, and
              file sharing in one focused room, making it easier to collaborate without making every conversation a trip.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={user ? "/dashboard" : "/register"} className="btn btn-lime">
                Make room to work
              </Link>
              <a href="#approach" className="btn btn-ghost">
                Explore our approach
              </a>
            </div>
            <p className="mt-5 text-xs leading-relaxed text-[var(--paper-dim)]">
              Remote collaboration can help avoid some travel. We do not estimate or claim emissions savings.
            </p>
          </div>

          <div className="eco-showcase relative min-h-[420px] overflow-hidden sm:min-h-[520px]">
            <Image
              src="/images/whiteboard.jpg"
              alt="A team collaborating around a shared digital whiteboard"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover"
            />
            <div className="eco-showcase-shade absolute inset-0" />
            <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-4 sm:inset-x-7 sm:bottom-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lime)]">One room, many ways to think</p>
                <p className="display mt-2 max-w-xs text-2xl font-semibold leading-tight text-white sm:text-3xl">
                  Make the meeting worth the connection.
                </p>
              </div>
              <span className="hidden border border-white/40 px-3 py-2 text-xs text-white sm:inline-flex">Video · Board · Files</span>
            </div>
          </div>
        </section>

        <section id="approach" className="eco-band border-y border-[var(--line)]">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-[0.8fr_1.2fr] md:items-end md:py-20">
            <div>
              <p className="stamp text-[var(--sea)]">A more considered way to meet</p>
              <h2 className="display mt-5 max-w-md text-4xl font-semibold leading-tight sm:text-5xl">
                Use the right amount of connection.
              </h2>
            </div>
            <p className="max-w-2xl text-lg leading-relaxed text-[var(--paper-dim)]">
              Not every conversation needs everyone in a room together. Quorum gives distributed teams a place to
              decide, sketch, and share in real time, while keeping the choice of how to participate with each person.
            </p>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="stamp text-[var(--lime)]">Built for real work</p>
              <h2 className="display mt-4 text-4xl font-semibold sm:text-5xl">Everything in one room.</h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-[var(--paper-dim)]">
              Fewer tools to juggle. More room for the conversation, and for the people in it.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
          <Feature
            image="/images/screen-share.jpg"
            number="01"
            title="Meet face to face, or audio first."
            copy="Join over WebRTC video, with the option to keep your camera off when it is not needed. Choose what works for you and your connection."
          />
          <Feature
            image="/images/whiteboard.jpg"
            number="02"
            title="Think together on a live board."
            copy="Sketch and map ideas while you talk. Shared strokes sync live, so the discussion and the work stay together."
          />
          <Feature
            image="/images/security.jpg"
            number="03"
            title="Share what matters, privately."
            copy="Pass files and messages in the room, with browser-side encryption for chat and files. Keep project context close to the people who need it."
          />
          </div>
        </section>

        <section className="eco-practices">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 md:grid-cols-[0.9fr_1.1fr] md:items-center md:py-20">
            <div>
              <p className="stamp text-[var(--ink)]">Small choices, better meetings</p>
              <h2 className="display mt-5 max-w-lg text-4xl font-semibold leading-tight text-[var(--ink)] sm:text-5xl">
                Make every call more intentional.
              </h2>
              <p className="mt-5 max-w-lg leading-relaxed text-[var(--ink-soft)]">
                The most responsible meeting is often the one with a clear purpose. Use a room when live collaboration
                helps, and let people choose how they show up.
              </p>
            </div>
            <ul className="divide-y divide-black/15 border-y border-black/15">
              <Practice number="01" title="Start with an agenda" copy="Give people context before the call and a clear decision to work toward." />
              <Practice number="02" title="Keep video optional" copy="Audio and chat are there when video is not useful or accessible." />
              <Practice number="03" title="Share only what you need" copy="Use the board and screen share to focus the room on the work at hand." />
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--line)] px-5 py-8 text-sm text-[var(--paper-dim)] sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <Link href="/" aria-label="Quorum home"><Logo /></Link>
          <p>Thoughtful rooms for people who work together.</p>
          <div className="flex items-center gap-4">
            <Link href="/login" className="transition hover:text-white">Sign in</Link>
            <Link href="/register" className="transition hover:text-white">Get started</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({ image, number, title, copy }: { image: string; number: string; title: string; copy: string }) {
  return (
    <article className="eco-feature overflow-hidden border border-[var(--line)]">
      <div className="relative h-56">
        <Image src={image} alt="" fill sizes="(max-width: 1024px) 100vw, 33vw" className="object-cover" />
      </div>
      <div className="p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--lime)]">{number}</p>
        <h3 className="display mt-3 text-2xl font-semibold leading-tight">{title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-[var(--paper-dim)]">{copy}</p>
      </div>
    </article>
  );
}

function Practice({ number, title, copy }: { number: string; title: string; copy: string }) {
  return (
    <li className="grid gap-3 py-5 sm:grid-cols-[3rem_1fr] sm:gap-5">
      <span className="display text-xl font-semibold text-[var(--coral)]">{number}</span>
      <div>
        <h3 className="display text-xl font-semibold text-[var(--ink)]">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{copy}</p>
      </div>
    </li>
  );
}
