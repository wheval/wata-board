import React, { useState } from 'react';

function Rate() {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Rating submitted:', { rating, review });
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setRating(0);
      setReview('');
    }, 3000);
  };

  const renderStars = () => {
    return [...Array(5)].map((_, index) => {
      const starNumber = index + 1;
      return (
        <button
          key={index}
          type="button"
          onClick={() => setRating(starNumber)}
          onMouseEnter={() => setHoverRating(starNumber)}
          onMouseLeave={() => setHoverRating(0)}
          className="p-1 focus:outline-none"
        >
          <svg
            className={`w-8 h-8 transition-colors ${starNumber <= (hoverRating || rating)
              ? 'text-yellow-400 fill-current'
              : 'text-slate-600'
              }`}
            stroke="currentColor"
            viewBox="0 0 24 24"
            fill={starNumber <= (hoverRating || rating) ? 'currentColor' : 'none'}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
        </button>
      );
    });
  };

  const averageRating = 4.5;
  const totalReviews = 128;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6 lg:p-8 shadow-xl shadow-black/20">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight mb-6">Rate Wata-Board</h1>

          <div className="grid gap-8 lg:grid-cols-2 mb-8">
            <div className="p-4 sm:p-6 rounded-xl bg-slate-950/50 border border-slate-800">
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-slate-100 mb-2">{averageRating}</div>
                <div className="flex justify-center gap-1 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className={`w-5 h-5 ${i < Math.floor(averageRating) ? 'text-yellow-400 fill-current' : 'text-slate-600'}`}
                      viewBox="0 0 24 24"
                    >
                      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  ))}
                </div>
                <p className="text-slate-400 text-sm">Based on {totalReviews} reviews</p>
              </div>
            </div>

            <div className="space-y-3">
              {[5, 4, 3, 2, 1].map((stars) => (
                <div key={stars} className="flex items-center gap-3">
                  <span className="text-sm text-slate-400 w-12 sm:w-16">{stars} star</span>
                  <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-400 rounded-full"
                      style={{ width: `${stars === 5 ? 60 : stars === 4 ? 25 : stars === 3 ? 10 : stars === 2 ? 3 : 2}%` }}
                    />
                  </div>
                  <span className="text-sm text-slate-500 w-10 text-right">
                    {stars === 5 ? 77 : stars === 4 ? 32 : stars === 3 ? 13 : stars === 2 ? 4 : 2}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8">
            <h2 className="text-xl font-semibold mb-4">Write a Review</h2>

            {submitted ? (
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-center">
                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="font-medium">Thank you for your feedback!</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-3">Your Rating</label>
                  <div className="flex gap-1 justify-center sm:justify-start">
                    {renderStars()}
                  </div>
                  <p className="mt-2 text-sm text-slate-400 text-center sm:text-left">
                    {rating > 0 && ['Terrible', 'Poor', 'Average', 'Good', 'Excellent'][rating - 1]}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">Your Review</label>
                  <textarea
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 outline-none ring-sky-500/30 placeholder:text-slate-500 focus:ring-4 focus:ring-sky-500/20 transition-all resize-none"
                    placeholder="Share your experience with Wata-Board..."
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={rating === 0}
                  className="w-full h-12 rounded-xl bg-sky-500 px-6 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 ring-1 ring-inset ring-white/10 transition hover:bg-sky-400 focus:outline-none focus:ring-4 focus:ring-sky-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Review
                </button>
              </form>
            )}
          </div>

          <div className="mt-8 p-4 rounded-xl bg-sky-500/10 border border-sky-500/20">
            <p className="text-sm text-sky-300 leading-relaxed">
              <span className="font-medium">Note:</span> All reviews are recorded on the blockchain for transparency.
              Please ensure your review is genuine and helpful to other users.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Rate;
