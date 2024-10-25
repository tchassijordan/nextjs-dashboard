'use server';

import { sql } from '@vercel/postgres';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Customer ID must be a string.',
  }),
  amount: z.coerce.number().gt(0, 'Amount must be greater than 0.'),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Status must be either "pending" or "paid".',
  }),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });

const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export interface IInvoiceState {
  errors?: Partial<Record<'customerId' | 'amount' | 'status', string[]>>;
  message?: string | null;
  formFields?: Partial<z.infer<typeof CreateInvoice>>;
}

export async function createInvoice(_: IInvoiceState, formData: FormData) {
  const formDataValidataion = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!formDataValidataion.success) {
    return {
      message: 'Invalid Form Data',
      errors: formDataValidataion.error.flatten().fieldErrors,
      formFields: {
        customerId: formData.get('customerId')?.toString() || undefined,
        amount: Number(formData.get('amount')?.toString()) || undefined,
        status: (formData.get('status')?.toString() || undefined) as z.infer<
          typeof CreateInvoice
        >['status'],
      },
    };
  }

  const { customerId, amount, status } = formDataValidataion.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  try {
    await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
      `;
  } catch (error) {
    return {
      message: 'Database Error: Failed to Create Invoice.',
    };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function updateInvoice(
  id: string,
  _: IInvoiceState,
  formData: FormData,
) {
  const validationResponse = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validationResponse?.success) {
    return {
      message: 'Invalid fields',
      errors: validationResponse?.error?.flatten()?.fieldErrors,
      formFields: {
        customerId: formData.get('customerId')?.toString() || '',
        amount: Number(formData.get('amount')?.toString()) || undefined,
        status: (formData.get('status')?.toString() || undefined) as z.infer<
          typeof CreateInvoice
        >['status'],
      },
    };
  }

  const { amount, customerId, status } = validationResponse.data;
  const amountInCents = amount * 100;

  try {
    await sql`
          UPDATE invoices
          SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
          WHERE id = ${id}
        `;
  } catch (error) {
    return { message: 'Database Error: Failed to Update Invoice.' };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath('/dashboard/invoices');
    return { message: 'Deleted Invoice.' };
  } catch (error) {
    return { message: 'Database Error: Failed to Delete Invoice.' };
  }
}
