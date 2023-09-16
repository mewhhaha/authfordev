import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Tailwind,
  Text,
} from "@react-email/components";

interface NotionMagicLinkEmailProps {
  otp?: string;
}

export const SendCodeEmail = ({
  otp = "{{123456}}",
}: NotionMagicLinkEmailProps) => (
  <Tailwind>
    <Html>
      <Head />
      <Preview>Register your device with this code</Preview>
      <Body className="font-sans">
        <Container className="rounded-md px-8 shadow-md">
          <Heading className="font-sans text-3xl font-normal">
            Register your device
          </Heading>
          <Text className="text-xl">
            Your registration code is below - enter it in the registration form
            where you requested this code.
          </Text>
          <div className="my-1 flex w-full">
            <code className="w-full rounded-sm border border-black bg-gray-100 p-4 py-10 text-center text-5xl font-semibold tracking-widest text-black shadow-sm">
              {otp}
            </code>
          </div>
          <Text>
            If you didn&apos;t request this code, you can safely ignore this
            email.
          </Text>
        </Container>
      </Body>
    </Html>
  </Tailwind>
);
