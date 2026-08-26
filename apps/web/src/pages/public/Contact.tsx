import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { FiMail, FiMapPin } from 'react-icons/fi';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';

const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  subject: z.string().min(3, 'Subject must be at least 3 characters'),
  message: z.string().min(20, 'Message must be at least 20 characters'),
});

type ContactInput = z.infer<typeof contactSchema>;

export default function Contact() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactInput>({ resolver: zodResolver(contactSchema) });

  function onSubmit(_data: ContactInput) {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        toast.success("Message sent! We'll get back to you within 24 hours.");
        reset();
        resolve();
      }, 800);
    });
  }

  return (
    <div className="container-page py-16">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-12">
        <div className="lg:col-span-2">
          <h1 className="text-3xl font-bold text-slate-900 mb-4 dark:text-slate-100">Get in touch</h1>
          <p className="text-slate-500 leading-relaxed mb-8 dark:text-slate-400">
            Have a question about the platform or want to explore a partnership? We'd love to hear from you.
          </p>

          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 dark:bg-indigo-950 dark:text-indigo-400">
                <FiMail className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Email</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">support@aip.edu</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 dark:bg-indigo-950 dark:text-indigo-400">
                <FiMapPin className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Office</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Placement Cell, Main Campus</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 dark:bg-slate-900 dark:border-slate-800">
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
              <Input
                label="Full name"
                placeholder="Jane Smith"
                error={errors.name?.message}
                {...register('name')}
              />
              <Input
                label="Email address"
                type="email"
                placeholder="jane@university.edu"
                error={errors.email?.message}
                {...register('email')}
              />
              <Input
                label="Subject"
                placeholder="How can we help?"
                error={errors.subject?.message}
                {...register('subject')}
              />
              <Textarea
                label="Message"
                placeholder="Tell us more about your query…"
                rows={5}
                error={errors.message?.message}
                {...register('message')}
              />
              <Button type="submit" loading={isSubmitting} className="w-full">
                Send message
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
