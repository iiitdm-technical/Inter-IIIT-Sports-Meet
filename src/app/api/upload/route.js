import { handleUpload } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';

export async function POST(request) {
  try {
    const body = await request.json();
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Authenticate the user (must be logged in as an IIIT to upload proofs)
        const session = await requireAuth(["iiit"]);
        
        // Generate a safe, structured pathname: payment-proofs/{iiitCode}/{timestamp}-{random}.{extension}
        const iiitCode = session.iiitCode;
        if (!iiitCode || !pathname.startsWith(`payment-proofs/${iiitCode}/`) ||
            !/^proof-\d+\.(pdf|jpg|jpeg|png)$/.test(pathname.slice(`payment-proofs/${iiitCode}/`.length))) {
          throw new Error('Invalid payment proof path');
        }
        const extension = pathname.split('.').pop().toLowerCase();
        
        // Allowed extensions: pdf, jpg, jpeg, png
        const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];
        if (!allowedExtensions.includes(extension)) {
          throw new Error('Invalid file type');
        }

        return {
          allowedContentTypes: ['application/pdf', 'image/jpeg', 'image/png'],
          maximumSizeInBytes: 5 * 1024 * 1024, // 5 MB
          validUntil: Date.now() + 5 * 60 * 1000, // Token valid for 5 minutes
          tokenPayload: JSON.stringify({ iiitCode }),
          addRandomSuffix: true,
          allowOverwrite: false,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("Vercel Blob Upload Error:", error);
    return NextResponse.json(
      { error: error.message || 'An error occurred during upload' },
      { status: error.statusCode || 400 }
    );
  }
}
