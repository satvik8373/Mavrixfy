import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import axiosInstance from '../lib/axios';
import { signOut } from '../services/authService';

const AccountDeletion = () => {
	const [isDeleting, setIsDeleting] = useState(false);
	const [confirmText, setConfirmText] = useState('');
	const { user } = useAuth();
	const navigate = useNavigate();

	const handleDeleteAccount = async () => {
		if (confirmText !== 'DELETE') {
			toast.error('Please type DELETE to confirm');
			return;
		}

		setIsDeleting(true);
		try {
			// Delete account from backend
			await axiosInstance.delete('/users/account');
			
			// Sign out from Firebase
			await signOut();
			
			// Show success message
			toast.success('Account deleted successfully. Redirecting to login...');
			
			// Redirect to login after a short delay
			setTimeout(() => {
				navigate('/login', { replace: true });
			}, 1500);
		} catch (error: any) {
			console.error('Error deleting account:', error);
			toast.error(error.response?.data?.message || 'Failed to delete account');
			setIsDeleting(false);
		}
	};

	return (
		<div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-3xl mx-auto pb-24">
				<div className="bg-card rounded-lg shadow-lg p-8">
					<h1 className="text-3xl font-semibold text-foreground mb-6">
						Account Deletion Request
					</h1>

					<div className="space-y-6 text-muted-foreground">
						<section>
							<h2 className="text-xl font-semibold text-foreground mb-3">
								How to Delete Your Account
							</h2>
							<p className="mb-4">
								If you wish to delete your account and associated data from our music streaming app,
								please follow these steps:
							</p>
							<ol className="list-decimal list-inside space-y-2 ml-4">
								<li>Log in to your account</li>
								<li>Navigate to this account deletion page</li>
								<li>Type "DELETE" in the confirmation field below</li>
								<li>Click the "Delete My Account" button</li>
							</ol>
						</section>

						<section>
							<h2 className="text-xl font-semibold text-foreground mb-3">
								What Data Will Be Deleted
							</h2>
							<p className="mb-2">When you delete your account, the following data will be permanently removed:</p>
							<ul className="list-disc list-inside space-y-1 ml-4">
								<li>Your user profile information (name, email, profile picture)</li>
								<li>Your playlists and saved songs</li>
								<li>Your liked songs and favorites</li>
								<li>Your listening history and preferences</li>
								<li>Your mood playlist data and analytics</li>
								<li>Any connected third-party service tokens (Mavrixfy, etc.)</li>
							</ul>
						</section>

						<section>
							<h2 className="text-xl font-semibold text-foreground mb-3">
								Data Retention Period
							</h2>
							<p>
								Your account and associated data will be deleted immediately upon confirmation.
								However, some data may be retained for up to 30 days in backup systems for
								disaster recovery purposes. After 30 days, all data will be permanently and
								irreversibly deleted from all systems.
							</p>
						</section>

						<section>
							<h2 className="text-xl font-semibold text-foreground mb-3">
								Data That May Be Kept
							</h2>
							<p className="mb-2">
								For legal and operational purposes, we may retain the following anonymized data:
							</p>
							<ul className="list-disc list-inside space-y-1 ml-4">
								<li>Aggregated analytics data (no personal identifiers)</li>
								<li>Transaction records required by law (if applicable)</li>
								<li>Logs necessary for security and fraud prevention (anonymized)</li>
							</ul>
						</section>

						{user && (
							<section className="border-t border-border pt-6 mt-8">
								<h2 className="text-xl font-semibold text-red-500 mb-3">
									Delete Your Account
								</h2>
								<div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
									<p className="text-red-600 dark:text-red-400 font-medium mb-2">
										⚠️ Warning: This action cannot be undone
									</p>
									<p className="text-sm text-red-600 dark:text-red-400">
										All your data will be permanently deleted. Please make sure you have backed up
										any important information before proceeding.
									</p>
								</div>

								<div className="space-y-4">
									<div>
										<label htmlFor="confirm" className="block text-sm font-medium text-foreground mb-2">
											Type "DELETE" to confirm:
										</label>
										<input
											id="confirm"
											type="text"
											value={confirmText}
											onChange={(e) => setConfirmText(e.target.value)}
											className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
											placeholder="DELETE"
										/>
									</div>

									<button type="button"
										onClick={handleDeleteAccount}
										disabled={isDeleting || confirmText !== 'DELETE'}
										className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
									>
										{isDeleting ? 'Deleting Account...' : 'Delete My Account'}
									</button>
								</div>
							</section>
						)}

						{!user && (
							<section className="border-t border-border pt-6 mt-8">
								<p className="text-center">
									Please{' '}
									<a href="/login" className="text-primary hover:underline">
										log in
									</a>{' '}
									to delete your account.
								</p>
							</section>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default AccountDeletion;

