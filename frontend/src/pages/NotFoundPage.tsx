import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'

export default function NotFoundPage() {
  return (
    <div>
      <PageHeader title="This page drifted out of orbit." lead="The address does not match any page on SolMate." />
      <div className="mx-auto max-w-4xl px-6 pb-24">
        <Button asChild variant="outline"><Link to="/">Back to start</Link></Button>
      </div>
    </div>
  )
}
